import { ConfigService } from '@nestjs/config';
import { BlackPearlProspectingProvider } from './blackpearl-prospecting.provider';

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
      });
    });

    it('returns null when the status check itself cannot complete', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

      const result = await buildProvider().getJobResult('job-1');

      expect(result).toBeNull();
    });
  });
});
