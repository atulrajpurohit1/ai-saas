import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiscoveredProspect,
  DiscoveredProspectSignal,
  ProspectDiscoveryResult,
} from '../types/prospect-search.types';
import {
  blackPearlHeaders,
  BLACKPEARL_TERMINAL_BUDGET_CODES,
  blackPearlRequest,
  type BlackPearlRequestOutcome,
  normalizeString,
} from './blackpearl-http.util';
import { UpstreamBudgetExceededError } from './upstream-budget-exceeded.error';

const DEFAULT_BASE_URL = 'https://api.blackpearl.com/v1';

/**
 * Describes what this platform's tenants sell, sent to BlackPearl as
 * required context for qualifying prospects (BlackPearl's `product_info`
 * field is required - it judges whether a discovered company/contact is a
 * plausible buyer for it). Every tenant on this platform genuinely is a
 * commercial security guard services company, so this is a true statement
 * of the business, not invented data; override via env if a deployment
 * needs different wording.
 */
const DEFAULT_PRODUCT_INFO =
  'Commercial security guard services for businesses: on-site security guards, patrols, incident response, and site monitoring for commercial properties.';

/** Statuses BlackPearl reports while a prospecting job is still in progress. */
const PENDING_JOB_STATUSES = new Set(['queued', 'running']);
const SUCCESS_JOB_STATUS = 'succeeded';

interface RawProspectCompany {
  name?: string | null;
  domain?: string | null;
  description?: string | null;
  industry?: string | null;
  headcount?: number | null;
  location?: string | null;
}

interface RawProspectProfile {
  full_name?: string | null;
  headline?: string | null;
  job_title?: string | null;
  seniority?: string | null;
  location?: string | null;
  profile_url?: string | null;
  company?: RawProspectCompany | null;
}

interface RawQualification {
  status?: string;
  score?: number;
  confidence?: number;
  reason?: string;
}

interface RawProspectEnrichment {
  status?: string;
  work_email?: string | null;
}

interface RawEvidenceRef {
  label?: string;
  snippet?: string | null;
}

interface RawProspect {
  id: string;
  profile?: RawProspectProfile | null;
  qualification?: RawQualification | null;
  enrichment?: RawProspectEnrichment | null;
  evidence?: RawEvidenceRef[] | null;
}

interface RawProspectingSummary {
  discovered?: number;
  qualified?: number;
}

interface RawProspectingResult {
  summary?: RawProspectingSummary | null;
  prospects?: RawProspect[] | null;
}

interface RawProspectingJobStage {
  label?: string;
  status?: string;
}

/**
 * `usage` on a finished job is what BlackPearl actually charged us for it
 * (PublicJobUsage in their OpenAPI). We ignored this field entirely until
 * now, which is why nothing in this system knew what a search cost.
 *
 * Note what it is NOT: there is no per-prospect line here. `cost_usd` is
 * driven by tokens and compute, so two searches returning the same number of
 * prospects can cost very different amounts.
 */
interface RawJobUsage {
  cost_usd?: number | null;
  tokens?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
}

interface RawProspectingJob {
  id: string;
  status: string;
  progress?: number | null;
  type?: string;
  error?: string | null;
  error_code?: string | null;
  stages?: RawProspectingJobStage[] | null;
  result?: RawProspectingResult | null;
  usage?: RawJobUsage | null;
}

/**
 * The slice of GET /v1/usage this system reads. BlackPearl's full
 * PublicUsageResponse also carries month-to-date rollups, per-capability
 * usage, quotas and the organization's usage tier; those are reporting, not
 * a spend decision, so they are deliberately not modelled here.
 */
interface RawUsageResponse {
  project_id?: string | null;
  credits?: {
    billing_enabled?: boolean;
    balance_usd?: number | null;
  } | null;
  budgets?: RawBudgetStatus[] | null;
}

interface RawBudgetStatus {
  scope?: string | null;
  capability_key?: string | null;
  limit_usd?: number | null;
  spend_usd?: number | null;
  remaining_usd?: number | null;
  hard_limit?: boolean | null;
  resets_at?: string | null;
}

/**
 * One monthly cost ceiling that will REFUSE work once reached (BlackPearl's
 * `hard_limit: true`). A soft budget only reports, so it is not a constraint
 * on spending and is not represented.
 *
 * Note the period: a budget is a monthly allowance that resets at
 * `resetsAt`, not a balance that accrues. It is a cap, never a source of
 * funds.
 */
export interface UpstreamHardBudget {
  /** Whose ceiling this is. An organization budget binds every project. */
  scope: 'organization' | 'project' | 'unknown';
  /** Null when the budget covers all capability spend. */
  capabilityKey: string | null;
  limitUsd: number;
  remainingUsd: number;
  resetsAt: string | null;
}

/** What BlackPearl will currently let us spend, and against which project. */
export interface UpstreamBudgetSnapshot {
  /**
   * The BlackPearl project this API key authenticates as. A key is
   * project-scoped, so this is fixed for a given key -- it is read so the
   * logs name the project whose budget refused a job.
   */
  projectId: string | null;
  /**
   * Prepaid credit balance in USD, or null when BlackPearl reports none
   * (e.g. an account on plan billing). ORGANIZATION-wide: every project, and
   * so every tenant, draws on this one pot.
   */
  prepaidBalanceUsd: number | null;
  /** The tightest hard budget standing between us and a refused job. */
  tightestHardBudget: UpstreamHardBudget | null;
}

export interface ProspectingTargetInput {
  companyNames?: string[];
  locations?: string[];
  industries?: string[];
  jobTitles?: string[];
  keywords?: string[];
  companyHeadcountMin?: number;
  companyHeadcountMax?: number;
}

export interface ProspectingSubmissionInput {
  objective: string;
  target?: ProspectingTargetInput;
  limit?: number;
}

export interface ProspectingJobPollResult {
  status: 'pending' | 'completed' | 'failed';
  progress: number | null;
  stageLabel: string | null;
  result: ProspectDiscoveryResult | null;
  /**
   * What this job actually cost us in USD, straight from BlackPearl, or null
   * when they did not report it. Recorded against the credit ledger so the
   * real cost of a search is knowable rather than assumed.
   */
  upstreamCostUsd: number | null;
}

/**
 * Live BlackPearl integration for real, multi-company/multi-contact prospect
 * discovery ("Prospecting" capability, POST /v1/prospects) - distinct from
 * BlackPearlInsightProvider, which only ever researches one already-named
 * company (POST /v1/playbooks). Confirmed enabled on our account via a live
 * GET /v1/capabilities call, and confirmed working end-to-end with a real
 * test job (3 real, differently-sourced companies with real contacts and
 * emails, ~60s turbo-mode runtime) before this provider was written.
 *
 * Async, same shape as Playbooks: POST /v1/prospects returns a job id
 * (type: "prospecting"), polled via the same generic GET /v1/jobs/{id}
 * endpoint already used by Playbooks (discriminated by the `type` field in
 * the response).
 */
@Injectable()
export class BlackPearlProspectingProvider {
  private readonly logger = new Logger(BlackPearlProspectingProvider.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.configService.get<string>('BLACKPEARL_API_KEY'));
  }

  async submitProspectingJob(
    input: ProspectingSubmissionInput,
  ): Promise<string | null> {
    const apiKey = this.configService.get<string>('BLACKPEARL_API_KEY');
    if (!apiKey) {
      this.logger.debug(
        'BLACKPEARL_API_KEY is not configured; skipping prospecting submission.',
      );
      return null;
    }

    const campaignName = `Prospect Search: ${input.objective}`.slice(0, 160);

    this.logger.log(
      `BlackPearl prospecting job creation: submitting objective="${input.objective}" limit=${input.limit ?? 10}`,
    );

    const outcome: BlackPearlRequestOutcome = {};
    const job = await blackPearlRequest<RawProspectingJob>(
      this.logger,
      `${this.getBaseUrl()}/prospects`,
      {
        method: 'POST',
        headers: blackPearlHeaders(apiKey),
        body: JSON.stringify({
          campaign_name: campaignName,
          product_info: this.getProductInfo(),
          objective: input.objective,
          limit: input.limit ?? 10,
          mode: 'turbo',
          target: {
            company_names: input.target?.companyNames ?? [],
            locations: input.target?.locations ?? [],
            industries: input.target?.industries ?? [],
            job_titles: input.target?.jobTitles ?? [],
            keywords: input.target?.keywords ?? [],
            company_headcount:
              input.target?.companyHeadcountMin ||
              input.target?.companyHeadcountMax
                ? {
                    min: input.target?.companyHeadcountMin ?? null,
                    max: input.target?.companyHeadcountMax ?? null,
                  }
                : null,
          },
        }),
      },
      `submit prospecting job for "${input.objective}"`,
      undefined,
      outcome,
    );

    if (!job?.id) {
      const budgetScope = outcome.errorCode
        ? BLACKPEARL_TERMINAL_BUDGET_CODES[outcome.errorCode]
        : undefined;
      if (budgetScope) {
        // An upstream spending limit, not a fault. Thrown rather than returned
        // as null so the service can answer 402 "out of budget" instead of the
        // 503 "try again later" that every other submission failure produces.
        throw new UpstreamBudgetExceededError(outcome.errorCode!, budgetScope);
      }
      this.logger.error(
        `BlackPearl prospecting job creation FAILED for objective="${input.objective}" - see the request log above for the exact HTTP failure.`,
      );
      return null;
    }

    this.logger.log(
      `BlackPearl prospecting job creation succeeded: jobId=${job.id} initialStatus="${job.status}"`,
    );

    return job.id;
  }

  async getJobResult(jobId: string): Promise<ProspectingJobPollResult | null> {
    const apiKey = this.configService.get<string>('BLACKPEARL_API_KEY');
    if (!apiKey) return null;

    const job = await blackPearlRequest<RawProspectingJob>(
      this.logger,
      `${this.getBaseUrl()}/jobs/${encodeURIComponent(jobId)}`,
      { method: 'GET', headers: blackPearlHeaders(apiKey) },
      `check prospecting job ${jobId}`,
      jobId,
    );

    if (!job) {
      this.logger.error(
        `BlackPearl prospecting job status check FAILED for jobId=${jobId} - see the request log above for the exact HTTP failure.`,
      );
      return null;
    }

    // A failed job can still have burned budget, so the cost is read before
    // branching on status rather than only on the success path.
    const upstreamCostUsd =
      typeof job.usage?.cost_usd === 'number' &&
      Number.isFinite(job.usage.cost_usd)
        ? job.usage.cost_usd
        : null;

    if (PENDING_JOB_STATUSES.has(job.status)) {
      return {
        status: 'pending',
        progress: typeof job.progress === 'number' ? job.progress : null,
        stageLabel: currentStageLabel(job.stages),
        result: null,
        upstreamCostUsd,
      };
    }

    if (job.status === SUCCESS_JOB_STATUS && job.result) {
      const result = normalizeProspectingResult(job.result);
      this.logger.log(
        `BlackPearl prospecting job FINAL STATUS: jobId=${jobId} status="succeeded" prospects=${
          result.prospects.length
        } costUsd=${upstreamCostUsd ?? 'unreported'}.`,
      );
      return {
        status: 'completed',
        progress: 100,
        stageLabel: null,
        result,
        upstreamCostUsd,
      };
    }

    this.logger.warn(
      `BlackPearl prospecting job FINAL STATUS: jobId=${jobId} status="${job.status}"${
        job.error ? ` (${job.error_code ?? 'error'}: ${job.error})` : ''
      } costUsd=${upstreamCostUsd ?? 'unreported'} - treating as failed.`,
    );

    return {
      status: 'failed',
      progress: null,
      stageLabel: null,
      result: null,
      upstreamCostUsd,
    };
  }

  /**
   * What BlackPearl will let us spend, from GET /v1/usage.
   *
   * This used to read only `credits.balance_usd` and throw the rest of the
   * response away, which left the spend guard enforcing a floor against the
   * prepaid pot while blind to a hard budget that would refuse the job at
   * zero remaining. The endpoint reports both, plus which project the key
   * authenticates as, so all three are returned here.
   *
   * Returns null ONLY when the figure could not be read at all (no API key,
   * or the call failed after retries). A successful read that simply reports
   * no prepaid balance comes back as a snapshot with a null
   * `prepaidBalanceUsd` -- the distinction matters, because the caller keeps
   * a last-known figure to fall back on when a read FAILS, and conflating
   * the two meant that fallback could never fire.
   */
  async getUpstreamStatus(): Promise<UpstreamBudgetSnapshot | null> {
    const apiKey = this.configService.get<string>('BLACKPEARL_API_KEY');
    if (!apiKey) return null;

    const usage = await blackPearlRequest<RawUsageResponse>(
      this.logger,
      `${this.getBaseUrl()}/usage`,
      { method: 'GET', headers: blackPearlHeaders(apiKey) },
      'check prepaid balance and budgets',
    );

    if (!usage) return null;

    const balance = usage.credits?.balance_usd;

    return {
      projectId: typeof usage.project_id === 'string' ? usage.project_id : null,
      prepaidBalanceUsd:
        typeof balance === 'number' && Number.isFinite(balance)
          ? balance
          : null,
      tightestHardBudget: tightestHardBudget(usage.budgets),
    };
  }

  private getBaseUrl(): string {
    return (
      this.configService.get<string>('BLACKPEARL_BASE_URL') || DEFAULT_BASE_URL
    );
  }

  private getProductInfo(): string {
    return (
      this.configService.get<string>('BLACKPEARL_PROSPECTING_PRODUCT_INFO') ||
      DEFAULT_PRODUCT_INFO
    );
  }
}

/** The currently-running (or most recently completed) stage's human-readable label, e.g. "Finding contacts". */
function currentStageLabel(
  stages: RawProspectingJobStage[] | null | undefined,
): string | null {
  if (!Array.isArray(stages) || stages.length === 0) return null;
  const running = stages.find((stage) => stage.status === 'running');
  if (running?.label) return running.label;
  const lastCompleted = [...stages]
    .reverse()
    .find((stage) => stage.status === 'completed');
  return lastCompleted?.label ?? stages[0]?.label ?? null;
}

function toSignals(
  evidence: RawEvidenceRef[] | null | undefined,
): DiscoveredProspectSignal[] {
  if (!Array.isArray(evidence)) return [];
  return evidence
    .map((item) => ({
      label: normalizeString(item.label) ?? '',
      snippet: normalizeString(item.snippet),
    }))
    .filter((item) => item.label);
}

/**
 * Maps one raw BlackPearl Prospect to our internal DiscoveredProspect.
 * Only `id` and `qualificationScore` are guaranteed - every other field is
 * genuinely optional in real responses (e.g. company headcount/industry are
 * frequently null), so nothing here is ever defaulted to a fabricated value.
 * `email` is only ever set when BlackPearl's own enrichment status is
 * "found" - a "pending"/"not_found"/"failed" enrichment never yields a
 * guessed email.
 */
function normalizeProspect(raw: RawProspect): DiscoveredProspect {
  const company = raw.profile?.company ?? undefined;

  return {
    id: raw.id,
    companyName: normalizeString(company?.name),
    companyDomain: normalizeString(company?.domain),
    companyIndustry: normalizeString(company?.industry),
    companyHeadcount:
      typeof company?.headcount === 'number' ? company.headcount : undefined,
    companyLocation: normalizeString(company?.location),
    companyDescription: normalizeString(company?.description),
    contact: {
      fullName: normalizeString(raw.profile?.full_name),
      jobTitle: normalizeString(raw.profile?.job_title),
      headline: normalizeString(raw.profile?.headline),
      location: normalizeString(raw.profile?.location),
      profileUrl: normalizeString(raw.profile?.profile_url),
      email:
        raw.enrichment?.status === 'found'
          ? normalizeString(raw.enrichment.work_email)
          : undefined,
    },
    qualificationScore:
      typeof raw.qualification?.score === 'number'
        ? raw.qualification.score
        : 0,
    qualificationReason: normalizeString(raw.qualification?.reason),
    signals: toSignals(raw.evidence),
  };
}

function normalizeProspectingResult(
  raw: RawProspectingResult,
): ProspectDiscoveryResult {
  const prospects = Array.isArray(raw.prospects)
    ? raw.prospects.map(normalizeProspect)
    : [];

  return {
    query: '',
    discoveredCount: raw.summary?.discovered ?? prospects.length,
    qualifiedCount: raw.summary?.qualified ?? prospects.length,
    prospects,
  };
}

/**
 * The hard budget with the least headroom, which is the one that will refuse
 * the next job. Soft budgets and budgets with no usable `remaining_usd` are
 * ignored: neither can tell us we are about to be refused.
 */
function tightestHardBudget(
  budgets: RawBudgetStatus[] | null | undefined,
): UpstreamHardBudget | null {
  if (!Array.isArray(budgets)) return null;

  const hard = budgets
    .filter(
      (budget) =>
        budget?.hard_limit === true &&
        typeof budget.remaining_usd === 'number' &&
        Number.isFinite(budget.remaining_usd),
    )
    .map((budget) => ({
      scope:
        budget.scope === 'organization'
          ? ('organization' as const)
          : budget.scope === 'project'
            ? ('project' as const)
            : ('unknown' as const),
      capabilityKey:
        typeof budget.capability_key === 'string'
          ? budget.capability_key
          : null,
      limitUsd:
        typeof budget.limit_usd === 'number' &&
        Number.isFinite(budget.limit_usd)
          ? budget.limit_usd
          : 0,
      remainingUsd: budget.remaining_usd as number,
      resetsAt: typeof budget.resets_at === 'string' ? budget.resets_at : null,
    }));

  if (hard.length === 0) return null;

  return hard.reduce((tightest, budget) =>
    budget.remainingUsd < tightest.remainingUsd ? budget : tightest,
  );
}
