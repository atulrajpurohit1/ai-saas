import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProspectCompanyInsight,
  ProspectCompanySummary,
} from '../../ai/ai.service';

const DEFAULT_BASE_URL = 'https://api.blackpearl.com/v1';
const DEFAULT_BRAND_PROFILE_KEY = 'blackpearl';
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * A single HTTP call to BlackPearl is retried this many times (in addition
 * to the first attempt) when it fails for a transient reason - network
 * error, timeout, HTTP 429, or HTTP 5xx (including 503, which BlackPearl has
 * confirmed is a transient condition - the job keeps running server-side
 * even when a status check returns 503). Backoff is exponential
 * (RETRY_BASE_DELAY_MS * 2^attempt). This is the fast, sub-request-level
 * retry for a momentary blip; the caller's own polling loop (every 15-30s,
 * for up to 30 minutes, per BlackPearl's guidance) is what carries a
 * sustained outage across multiple polls without giving up or resubmitting
 * the job. Auth failures (401/403) and 404 are never retried - retrying
 * won't fix those.
 */
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

/** Truncated for log readability - a completed playbook body can be several KB. */
const LOG_BODY_PREVIEW_CHARS = 500;

/**
 * Statuses BlackPearl reports while a playbook job is still in progress.
 * Confirmed empirically against the live API: a job goes queued -> running
 * -> succeeded, and can take upwards of ten minutes.
 */
const PENDING_JOB_STATUSES = new Set(['queued', 'running']);

/** Confirmed empirically: the terminal success status is "succeeded", not "completed". */
const SUCCESS_JOB_STATUS = 'succeeded';

/**
 * Raw shape of a completed BlackPearl playbook result, as actually returned
 * by GET /v1/jobs/{id} once status is "succeeded". This does NOT match the
 * why_match/opportunity/outreach_strategy/security_needs/next_conversation
 * shape assumed by earlier code - that shape does not exist anywhere in the
 * real API. Every field below was observed in a live response; all are
 * optional because real responses have had several of them null or empty.
 */
interface RawBlackPearlPersona {
  name?: string;
  title?: string;
  description?: string;
}

interface RawBlackPearlObjection {
  objection?: string;
  response?: string;
}

interface RawBlackPearlResult {
  company_name?: string | null;
  domain?: string | null;
  website?: string | null;
  business_summary?: string | null;
  business_objective?: string | null;
  value_props?: unknown;
  sales_angles?: unknown;
  key_personas?: unknown;
  potential_objections?: unknown;
  meeting_note_example?: string | null;
  contact_overview?: string | null;
  readiness_level?: string | null;
  document_url?: string | null;
}

interface RawBlackPearlJob {
  id: string;
  status: string;
  progress?: number | null;
  error?: string | null;
  error_code?: string | null;
  result?: RawBlackPearlResult | null;
  input?: { target_company?: string } | null;
}

export interface BlackPearlJobResult {
  jobId: string;
  status: 'pending' | 'completed' | 'failed';
  progress: number | null;
  companyName: string | null;
  insight: ProspectCompanyInsight | null;
}

/**
 * Live BlackPearl (Bebop) integration for per-company sales "playbooks".
 *
 * BlackPearl's POST /v1/playbooks is asynchronous: it queues a job and
 * returns immediately (HTTP 202) with just a job id - the actual playbook
 * is only available later via GET /v1/jobs/{id}, once that job's status is
 * "succeeded". Confirmed against the live API: jobs commonly take several
 * minutes (observed: ~13 minutes for one playbook) to reach a terminal
 * status, so callers that need the real result must poll getJobResult()
 * themselves rather than expect submitPlaybookJob() to hand it back
 * directly.
 */
@Injectable()
export class BlackPearlInsightProvider {
  private readonly logger = new Logger(BlackPearlInsightProvider.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.configService.get<string>('BLACKPEARL_API_KEY'));
  }

  /**
   * Submits a playbook job and returns its id, or null if it couldn't be
   * submitted (unconfigured, auth, quota, timeout, network error - all
   * logged, never exposing the API key).
   */
  async submitPlaybookJob(
    company: ProspectCompanySummary,
  ): Promise<string | null> {
    const apiKey = this.configService.get<string>('BLACKPEARL_API_KEY');
    if (!apiKey) {
      this.logger.debug(
        'BLACKPEARL_API_KEY is not configured; skipping BlackPearl playbook submission.',
      );
      return null;
    }

    this.logger.log(
      `BlackPearl job creation: submitting playbook request for company="${company.name}" brandProfileKey="${this.getBrandProfileKey()}"`,
    );

    const job = await this.request<RawBlackPearlJob>(
      `${this.getBaseUrl()}/playbooks`,
      {
        method: 'POST',
        headers: this.buildHeaders(apiKey),
        body: JSON.stringify({
          target_company: company.name,
          brand_profile_key: this.getBrandProfileKey(),
        }),
      },
      `submit playbook for "${company.name}"`,
    );

    if (!job?.id) {
      this.logger.error(
        `BlackPearl job creation FAILED for company="${company.name}" - see the request log above for the exact HTTP failure.`,
      );
      return null;
    }

    this.logger.log(
      `BlackPearl job creation succeeded: jobId=${job.id} company="${company.name}" initialStatus="${job.status}"`,
    );

    return job.id;
  }

  /**
   * Checks the status of a previously submitted job with a single request
   * (transient HTTP failures are retried inside request() itself). Returns
   * null only if the status check itself could not be completed after
   * retries (auth, sustained network/5xx failure, malformed response) - a
   * genuinely still-running job is a normal "pending" result, not a null.
   * Callers that need the finished playbook should call this repeatedly
   * (e.g. on a polling interval) until the status is no longer "pending" -
   * which, per observed job durations, can take upwards of ten minutes.
   */
  async getJobResult(jobId: string): Promise<BlackPearlJobResult | null> {
    const apiKey = this.configService.get<string>('BLACKPEARL_API_KEY');
    if (!apiKey) return null;

    const job = await this.request<RawBlackPearlJob>(
      `${this.getBaseUrl()}/jobs/${encodeURIComponent(jobId)}`,
      { method: 'GET', headers: this.buildHeaders(apiKey) },
      `check job ${jobId}`,
      jobId,
    );

    if (!job) {
      this.logger.error(
        `BlackPearl job polling FAILED for jobId=${jobId} - status check could not be completed after retries. See the request log above for the exact HTTP failure. This poll attempt will be reported as unavailable, NOT as a job failure.`,
      );
      return null;
    }

    const companyName = job.input?.target_company ?? null;

    if (PENDING_JOB_STATUSES.has(job.status)) {
      this.logger.log(
        `BlackPearl job polling: jobId=${jobId} status="${job.status}" progress=${job.progress ?? 'n/a'} - still running.`,
      );
      return {
        jobId,
        status: 'pending',
        progress: typeof job.progress === 'number' ? job.progress : null,
        companyName,
        insight: null,
      };
    }

    if (job.status === SUCCESS_JOB_STATUS && job.result) {
      const insight = normalizeBlackPearlResult(job.result, companyName);
      if (insight) {
        this.logger.log(
          `BlackPearl job FINAL STATUS: jobId=${jobId} status="succeeded" - result parsed successfully for company="${insight.companyName}".`,
        );
        return {
          jobId,
          status: 'completed',
          progress: 100,
          companyName,
          insight,
        };
      }
      this.logger.warn(
        `BlackPearl job FINAL STATUS: jobId=${jobId} status="succeeded" but result parsing FAILED (no usable company name in the result payload) - treating as failed.`,
      );
    } else {
      // Covers every terminal-but-not-successful status BlackPearl can
      // report (failed, cancelled, timeout, error, or anything
      // unrecognized) - logged verbatim since the exact set of failure
      // status strings isn't documented anywhere we have access to.
      this.logger.warn(
        `BlackPearl job FINAL STATUS: jobId=${jobId} status="${job.status}"${
          job.error ? ` (${job.error_code ?? 'error'}: ${job.error})` : ''
        } - treating as failed.`,
      );
    }

    return { jobId, status: 'failed', progress: null, companyName, insight: null };
  }

  /**
   * Convenience wrapper for callers that want a single synchronous-feeling
   * result (the single-company /insights endpoint, which falls back to
   * Gemini on a miss): submits the job and polls briefly. Given real jobs
   * commonly take minutes, this will almost always return null and let the
   * caller fall back - it only succeeds for an unusually fast job. Callers
   * that need the real result for a slow job should use
   * submitPlaybookJob()/getJobResult() with their own polling instead.
   */
  async getPlaybook(
    company: ProspectCompanySummary,
  ): Promise<ProspectCompanyInsight | null> {
    if (!this.isConfigured()) return null;

    const jobId = await this.submitPlaybookJob(company);
    if (!jobId) return null;

    const shortPollAttempts = 3;
    const shortPollDelayMs = 2000;

    for (let attempt = 0; attempt < shortPollAttempts; attempt += 1) {
      await sleep(shortPollDelayMs);
      const result = await this.getJobResult(jobId);
      if (!result || result.status === 'pending') continue;
      return result.status === 'completed' ? result.insight : null;
    }

    this.logger.debug(
      `BlackPearl job ${jobId} did not finish within the short-poll window; not waiting further here.`,
    );
    return null;
  }

  private getBaseUrl(): string {
    return (
      this.configService.get<string>('BLACKPEARL_BASE_URL') || DEFAULT_BASE_URL
    );
  }

  private getBrandProfileKey(): string {
    return (
      this.configService.get<string>('BLACKPEARL_BRAND_PROFILE_KEY') ||
      DEFAULT_BRAND_PROFILE_KEY
    );
  }

  private buildHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Performs one HTTP call to BlackPearl, retrying transient failures
   * (network error, timeout, 429, 5xx) up to MAX_ATTEMPTS times with
   * exponential backoff. 401/403/404 are never retried. Every attempt logs
   * its outgoing request and the resulting response (status, elapsed time,
   * and a truncated body preview) so a failure's exact cause is always
   * visible in the logs, not just its final null result. A 503 specifically
   * gets a full, untruncated structured capture (status, body, headers,
   * job id, timestamp) - confirmed by BlackPearl as a transient condition
   * during job polling, so this is the signal most worth debugging in full
   * if it ever needs investigating.
   */
  private async request<T>(
    url: string,
    init: RequestInit,
    context: string,
    jobId?: string,
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const startedAt = Date.now();

      this.logger.debug(
        `BlackPearl -> ${init.method} ${context} (attempt ${attempt}/${MAX_ATTEMPTS})`,
      );

      let response: Response;
      try {
        response = await fetch(url, { ...init, signal: controller.signal });
      } catch (error) {
        clearTimeout(timeout);
        const elapsedMs = Date.now() - startedAt;
        const isTimeout = error instanceof Error && error.name === 'AbortError';
        const reason = isTimeout
          ? `timed out after ${REQUEST_TIMEOUT_MS}ms`
          : `network error: ${error instanceof Error ? error.message : String(error)}`;

        this.logger.error(
          `BlackPearl <- FAILED ${context} (attempt ${attempt}/${MAX_ATTEMPTS}) after ${elapsedMs}ms: ${reason}`,
        );

        if (attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }
        return null;
      }
      clearTimeout(timeout);

      const elapsedMs = Date.now() - startedAt;
      const bodyText = await safeReadText(response);

      if (response.status === 401 || response.status === 403) {
        this.logger.error(
          `BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms - authentication failed, check BLACKPEARL_API_KEY. Body: ${truncate(bodyText)}`,
        );
        return null; // never retry - a bad key won't fix itself
      }

      if (response.status === 404) {
        this.logger.warn(
          `BlackPearl <- HTTP 404 ${context} in ${elapsedMs}ms. Body: ${truncate(bodyText)}`,
        );
        return null; // never retry - the resource genuinely doesn't exist
      }

      if (response.status === 503) {
        this.logCompleteErrorResponse(response, bodyText, context, jobId);
      }

      if (response.status === 429 || response.status >= 500) {
        if (response.status !== 503) {
          this.logger.error(
            `BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms - transient failure. Body: ${truncate(bodyText)}`,
          );
        }
        if (attempt < MAX_ATTEMPTS) {
          const backoffMs =
            RETRY_BASE_DELAY_MS *
            2 ** (attempt - 1) *
            (response.status === 429 ? 2 : 1);
          await sleep(backoffMs);
          continue;
        }
        return null;
      }

      if (!response.ok) {
        this.logger.error(
          `BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms. Body: ${truncate(bodyText)}`,
        );
        return null;
      }

      this.logger.log(
        `BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms. Body: ${truncate(bodyText)}`,
      );

      try {
        return JSON.parse(bodyText) as T;
      } catch (error) {
        this.logger.error(
          `BlackPearl returned an unparseable response trying to ${context}: ${
            error instanceof Error ? error.message : String(error)
          }. Raw body: ${truncate(bodyText)}`,
        );
        return null;
      }
    }

    return null;
  }

  /**
   * Full, untruncated capture of a 503 response for debugging - status,
   * complete body, response headers, job id, and an explicit ISO timestamp.
   * Only ever logs response headers (never our own outgoing Authorization
   * request header), so the API key is never exposed.
   */
  private logCompleteErrorResponse(
    response: Response,
    bodyText: string,
    context: string,
    jobId?: string,
  ): void {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    this.logger.error(
      `BlackPearl 503 (transient - job continues running server-side) trying to ${context}: ${JSON.stringify(
        {
          httpStatus: response.status,
          jobId: jobId ?? null,
          timestamp: new Date().toISOString(),
          responseHeaders: headers,
          responseBody: bodyText,
        },
      )}`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return `<failed to read response body: ${error instanceof Error ? error.message : String(error)}>`;
  }
}

function truncate(text: string, maxLength: number = LOG_BODY_PREVIEW_CHARS): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}... (${text.length} chars total)`;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeString(value: string | null | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizePersonas(value: unknown): ProspectCompanyInsight['keyPersonas'] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is RawBlackPearlPersona => typeof item === 'object' && item !== null)
    .map((item) => ({
      name: normalizeString(item.name) ?? 'Unknown',
      title: normalizeString(item.title),
      description: normalizeString(item.description),
    }));
}

function normalizeObjections(value: unknown): ProspectCompanyInsight['potentialObjections'] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is RawBlackPearlObjection => typeof item === 'object' && item !== null)
    .map((item) => ({
      objection: normalizeString(item.objection) ?? '',
      response: normalizeString(item.response) ?? '',
    }))
    .filter((item) => item.objection && item.response);
}

/**
 * Maps BlackPearl's actual result schema to our internal ProspectCompanyInsight.
 * companyName is the only hard requirement (falling back to the originally
 * submitted target company name if BlackPearl didn't echo one back) -
 * everything else is genuinely optional in real responses.
 */
function normalizeBlackPearlResult(
  raw: RawBlackPearlResult,
  fallbackCompanyName: string | null,
): ProspectCompanyInsight | null {
  const companyName = normalizeString(raw.company_name) ?? fallbackCompanyName ?? undefined;
  if (!companyName) return null;

  return {
    companyName,
    domain: normalizeString(raw.domain),
    website: normalizeString(raw.website),
    businessSummary: normalizeString(raw.business_summary),
    businessObjective: normalizeString(raw.business_objective),
    valueProps: toStringArray(raw.value_props),
    salesAngles: toStringArray(raw.sales_angles),
    keyPersonas: normalizePersonas(raw.key_personas),
    potentialObjections: normalizeObjections(raw.potential_objections),
    meetingNoteExample: normalizeString(raw.meeting_note_example),
    contactOverview: normalizeString(raw.contact_overview),
    readinessLevel: normalizeString(raw.readiness_level),
    documentUrl: normalizeString(raw.document_url),
  };
}
