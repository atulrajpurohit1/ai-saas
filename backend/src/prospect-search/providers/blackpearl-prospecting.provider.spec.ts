import { ConfigService } from '@nestjs/config';
import { BlackPearlProspectingProvider } from './blackpearl-prospecting.provider';
import { UpstreamBudgetExceededError } from './upstream-budget-exceeded.error';

function buildProvider(overrides: Record<string, string | undefined> = {}) {
  const merged: Record<string, string | undefined> = {
    BLACKPEARL_API_KEY: 'test-key',
    ...overrides,
  };
  const configService = {
    get: jest.fn((key: string) => merged[key]),
  };
  return new BlackPearlProspectingProvider(
    configService as unknown as ConfigService,
  );
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as Response;
}

describe('BlackPearlProspectingProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  /**
   * These cover the only record we have of what Prospect Search costs us.
   * BlackPearl reports it per job and we discarded it entirely until now, so a
   * regression here would silently return the system to having no idea whether
   * a search makes money.
   */
  describe('upstream cost capture', () => {
    it('reads cost_usd off a completed job', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          id: 'job-1',
          status: 'succeeded',
          type: 'prospecting',
          usage: { cost_usd: 2.4567, tokens: 45200 },
          result: { prospects: [] },
        }),
      );

      const result = await buildProvider().getJobResult('job-1');
      expect(result?.upstreamCostUsd).toBe(2.4567);
    });

    it('reads cost_usd off a FAILED job, which still spent money', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          id: 'job-1',
          status: 'failed',
          type: 'prospecting',
          error: 'upstream timeout',
          usage: { cost_usd: 0.91 },
        }),
      );

      const result = await buildProvider().getJobResult('job-1');
      expect(result?.status).toBe('failed');
      expect(result?.upstreamCostUsd).toBe(0.91);
    });

    it('reports null, never zero, when usage is absent', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          id: 'job-1',
          status: 'succeeded',
          type: 'prospecting',
          result: { prospects: [] },
        }),
      );

      // Zero would be a lie that averages into the margin figures as though
      // the search were free.
      expect(
        (await buildProvider().getJobResult('job-1'))?.upstreamCostUsd,
      ).toBeNull();
    });

    it('ignores a non-numeric cost rather than propagating NaN', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          id: 'job-1',
          status: 'succeeded',
          type: 'prospecting',
          usage: { cost_usd: 'not-a-number' },
          result: { prospects: [] },
        }),
      );

      expect(
        (await buildProvider().getJobResult('job-1'))?.upstreamCostUsd,
      ).toBeNull();
    });
  });

  describe('getUpstreamStatus', () => {
    it('returns the prepaid balance and the project it belongs to', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          project_id: 'proj_123',
          credits: { billing_enabled: true, balance_usd: 487.25 },
          budgets: [],
        }),
      );

      await expect(buildProvider().getUpstreamStatus()).resolves.toEqual({
        projectId: 'proj_123',
        prepaidBalanceUsd: 487.25,
        tightestHardBudget: null,
      });
    });

    /**
     * A hard budget refuses work at zero remaining whether or not the prepaid
     * pot is healthy, so it has to come back from this read -- the previous
     * version looked only at `credits` and could not see it.
     */
    it('returns the hard budget with the least headroom', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          project_id: 'proj_123',
          credits: { billing_enabled: true, balance_usd: 900 },
          budgets: [
            {
              period: 'month',
              scope: 'organization',
              limit_usd: 500,
              spend_usd: 100,
              remaining_usd: 400,
              hard_limit: true,
              resets_at: '2026-11-01T00:00:00Z',
            },
            {
              period: 'month',
              scope: 'project',
              limit_usd: 50,
              spend_usd: 48,
              remaining_usd: 2,
              hard_limit: true,
              resets_at: '2026-11-01T00:00:00Z',
            },
          ],
        }),
      );

      await expect(buildProvider().getUpstreamStatus()).resolves.toEqual({
        projectId: 'proj_123',
        prepaidBalanceUsd: 900,
        tightestHardBudget: {
          scope: 'project',
          capabilityKey: null,
          limitUsd: 50,
          remainingUsd: 2,
          resetsAt: '2026-11-01T00:00:00Z',
        },
      });
    });

    /** A soft budget only reports; it cannot refuse a job, so it is not a constraint. */
    it('ignores budgets that are not hard limits', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          credits: { balance_usd: 900 },
          budgets: [
            {
              scope: 'project',
              limit_usd: 50,
              remaining_usd: 1,
              hard_limit: false,
            },
          ],
        }),
      );

      await expect(buildProvider().getUpstreamStatus()).resolves.toEqual({
        projectId: null,
        prepaidBalanceUsd: 900,
        tightestHardBudget: null,
      });
    });

    /**
     * "Read fine, reports no balance" is NOT the same as "could not read", and
     * the caller's last-known fallback depends on telling them apart.
     */
    it('reports a null balance when the read succeeded but no balance was given', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(jsonResponse(200, { rollup: { cost_usd: 1.2 } }));

      await expect(buildProvider().getUpstreamStatus()).resolves.toEqual({
        projectId: null,
        prepaidBalanceUsd: null,
        tightestHardBudget: null,
      });
    });

    it('returns null when the usage read fails', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(500, {}));

      await expect(buildProvider().getUpstreamStatus()).resolves.toBeNull();
    });

    it('returns null when BlackPearl is not configured', async () => {
      await expect(
        buildProvider({ BLACKPEARL_API_KEY: undefined }).getUpstreamStatus(),
      ).resolves.toBeNull();
    });
  });

  describe('isConfigured', () => {
    it('is true when BLACKPEARL_API_KEY is set', () => {
      expect(buildProvider().isConfigured()).toBe(true);
    });

    it('is false when BLACKPEARL_API_KEY is missing', () => {
      expect(
        buildProvider({ BLACKPEARL_API_KEY: undefined }).isConfigured(),
      ).toBe(false);
    });
  });

  describe('submitProspectingJob', () => {
    it('sends the objective, product_info, target filters, and turbo mode, and returns the job id', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(
          jsonResponse(202, { id: 'job-prospecting-1', status: 'queued' }),
        );
      global.fetch = fetchMock;

      const jobId = await buildProvider().submitProspectingJob({
        objective: 'Marketing agencies in India',
        target: { locations: ['India'], industries: ['Marketing'] },
        limit: 5,
      });

      expect(jobId).toBe('job-prospecting-1');
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.blackpearl.com/v1/prospects');
      const body = JSON.parse(init.body as string) as {
        objective: string;
        mode: string;
        limit: number;
        product_info: string;
        target: { locations: string[]; industries: string[] };
      };
      expect(body.objective).toBe('Marketing agencies in India');
      expect(body.mode).toBe('turbo');
      expect(body.limit).toBe(5);
      expect(body.target.locations).toEqual(['India']);
      expect(body.target.industries).toEqual(['Marketing']);
      expect(typeof body.product_info).toBe('string');
      expect(body.product_info.length).toBeGreaterThan(0);
    });

    it('returns null without calling fetch when unconfigured', async () => {
      global.fetch = jest.fn();

      const jobId = await buildProvider({
        BLACKPEARL_API_KEY: undefined,
      }).submitProspectingJob({ objective: 'Marketing agencies in India' });

      expect(jobId).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null when BlackPearl rejects the request', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(jsonResponse(401, { detail: 'unauthorized' }));

      const jobId = await buildProvider().submitProspectingJob({
        objective: 'Marketing agencies in India',
      });

      expect(jobId).toBeNull();
    });
    /**
     * A spending limit is not a failure. The provider throws so the service
     * can decide who to tell -- the customer, or an operator -- instead of
     * every refusal looking like a BlackPearl outage.
     */
    it('throws UpstreamBudgetExceededError when a hard budget refused the job', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(429, {
          error: {
            code: 'budget_exceeded',
            message: 'A hard monthly budget rejected this request.',
            request_id: 'req_2',
            docs_url: 'https://api.blackpearl.com/docs/errors',
          },
        }),
      );
      global.fetch = fetchMock;

      await expect(
        buildProvider().submitProspectingJob({
          objective: 'Marketing agencies in India',
        }),
      ).rejects.toBeInstanceOf(UpstreamBudgetExceededError);

      // Not retried: a ceiling that has already refused us is not a blip.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getJobResult', () => {
    it('reports pending with progress and the current running stage label', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          id: 'job-1',
          status: 'running',
          progress: 55,
          type: 'prospecting',
          stages: [
            {
              key: 'understand',
              label: 'Understanding the brief',
              status: 'completed',
            },
            { key: 'search', label: 'Searching the web', status: 'running' },
            {
              key: 'qualify',
              label: 'Scoring & qualifying',
              status: 'pending',
            },
          ],
        }),
      );

      const result = await buildProvider().getJobResult('job-1');

      expect(result).toEqual({
        status: 'pending',
        progress: 55,
        stageLabel: 'Searching the web',
        result: null,
        // Not reported on a job that is still running.
        upstreamCostUsd: null,
      });
    });

    it('normalizes a completed job into real prospects, only setting email when enrichment found one', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          id: 'job-1',
          status: 'succeeded',
          progress: 100,
          type: 'prospecting',
          result: {
            summary: { discovered: 2, qualified: 2 },
            prospects: [
              {
                id: 'pros_1',
                profile: {
                  full_name: 'Greg Middleton',
                  job_title: 'Senior Facilities Manager',
                  location: 'Kansas City, MO',
                  profile_url: 'https://linkedin.com/in/greg-middleton',
                  company: {
                    name: 'Vml',
                    domain: 'vml.com',
                    industry: 'Advertising Services',
                    headcount: null,
                    location: 'Kansas City, MO',
                  },
                },
                qualification: {
                  status: 'qualified',
                  score: 1,
                  reason: 'Large Indian marketing/advertising agency.',
                },
                enrichment: { status: 'found', work_email: 'greg@vmlyr.com' },
                evidence: [
                  {
                    label: 'Provider evidence',
                    snippet: 'Manages multiple offices.',
                  },
                ],
              },
              {
                id: 'pros_2',
                profile: { company: { name: 'Unenriched Co' } },
                qualification: {
                  status: 'qualified',
                  score: 0.6,
                  reason: 'Plausible fit.',
                },
                enrichment: { status: 'pending' },
                evidence: [],
              },
            ],
          },
        }),
      );

      const result = await buildProvider().getJobResult('job-1');

      expect(result?.status).toBe('completed');
      expect(result?.result?.discoveredCount).toBe(2);
      expect(result?.result?.qualifiedCount).toBe(2);
      expect(result?.result?.prospects).toHaveLength(2);

      const [first, second] = result!.result!.prospects;
      expect(first).toEqual({
        id: 'pros_1',
        companyName: 'Vml',
        companyDomain: 'vml.com',
        companyIndustry: 'Advertising Services',
        companyHeadcount: undefined,
        companyLocation: 'Kansas City, MO',
        companyDescription: undefined,
        contact: {
          fullName: 'Greg Middleton',
          jobTitle: 'Senior Facilities Manager',
          headline: undefined,
          location: 'Kansas City, MO',
          profileUrl: 'https://linkedin.com/in/greg-middleton',
          email: 'greg@vmlyr.com',
        },
        qualificationScore: 1,
        qualificationReason: 'Large Indian marketing/advertising agency.',
        signals: [
          { label: 'Provider evidence', snippet: 'Manages multiple offices.' },
        ],
      });

      // Enrichment still "pending" -> never guess an email.
      expect(second.contact.email).toBeUndefined();
      expect(second.companyHeadcount).toBeUndefined();
    });

    it('treats a non-succeeded terminal status as failed', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          id: 'job-1',
          status: 'failed',
          type: 'prospecting',
        }),
      );

      const result = await buildProvider().getJobResult('job-1');

      expect(result).toEqual({
        status: 'failed',
        progress: null,
        stageLabel: null,
        result: null,
        upstreamCostUsd: null,
      });
    });

    it('returns null when the status check itself cannot complete', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

      const result = await buildProvider().getJobResult('job-1');

      expect(result).toBeNull();
    });
  });
});
