import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { BlackPearlInsightProvider } from './blackpearl-insight.provider';

function buildProvider(overrides: Record<string, string | undefined> = {}) {
  const merged: Record<string, string | undefined> = {
    BLACKPEARL_API_KEY: 'test-key',
    ...overrides,
  };
  const configService = {
    get: jest.fn((key: string) => merged[key]),
  };
  return new BlackPearlInsightProvider(configService as unknown as ConfigService);
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as Response;
}

const COMPANY = { name: 'Acme Corp' };

describe('BlackPearlInsightProvider', () => {
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
      expect(buildProvider({ BLACKPEARL_API_KEY: undefined }).isConfigured()).toBe(false);
    });
  });

  describe('submitPlaybookJob', () => {
    it('returns the job id from a successful submission', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(202, { id: 'job-1', status: 'queued' }));
      const provider = buildProvider();

      await expect(provider.submitPlaybookJob(COMPANY)).resolves.toBe('job-1');
    });

    it('returns null when unconfigured, without making a network call', async () => {
      global.fetch = jest.fn();
      const provider = buildProvider({ BLACKPEARL_API_KEY: undefined });

      await expect(provider.submitPlaybookJob(COMPANY)).resolves.toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null on a 401', async () => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(401, { detail: 'unauthorized' }));
      const provider = buildProvider();

      await expect(provider.submitPlaybookJob(COMPANY)).resolves.toBeNull();
    });

    it('returns null on a network error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const provider = buildProvider();

      await expect(provider.submitPlaybookJob(COMPANY)).resolves.toBeNull();
    });
  });

  describe('getJobResult', () => {
    it('reports pending with progress while status is "queued" or "running"', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(200, { id: 'job-1', status: 'running', progress: 42, input: { target_company: 'Acme Corp' } }),
      );
      const provider = buildProvider();

      await expect(provider.getJobResult('job-1')).resolves.toEqual({
        jobId: 'job-1',
        status: 'pending',
        progress: 42,
        companyName: 'Acme Corp',
        insight: null,
      });
    });

    it('maps a "succeeded" job into the normalized insight - the real terminal status, not "completed"', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          id: 'job-1',
          status: 'succeeded',
          progress: 100,
          input: { target_company: 'Acme Corp' },
          result: {
            company_name: 'Acme Corp',
            domain: 'acme.com',
            website: 'https://acme.com',
            business_summary: 'Growing widget maker.',
            business_objective: 'Needs scalable coverage.',
            value_props: ['Faster onboarding'],
            sales_angles: ['Lead with ROI'],
            key_personas: [{ name: 'Jane Doe', title: 'VP Sales', description: 'Decision maker' }],
            potential_objections: [{ objection: 'Too expensive', response: 'ROI in 3 months' }],
            meeting_note_example: 'Ask about current vendor.',
            contact_overview: 'No enriched contacts.',
            readiness_level: 'warm',
            document_url: 'https://blackpearl.example.com/pbk_1',
          },
        }),
      );
      const provider = buildProvider();

      const result = await provider.getJobResult('job-1');

      expect(result?.status).toBe('completed');
      expect(result?.insight).toEqual({
        companyName: 'Acme Corp',
        domain: 'acme.com',
        website: 'https://acme.com',
        businessSummary: 'Growing widget maker.',
        businessObjective: 'Needs scalable coverage.',
        valueProps: ['Faster onboarding'],
        salesAngles: ['Lead with ROI'],
        keyPersonas: [{ name: 'Jane Doe', title: 'VP Sales', description: 'Decision maker' }],
        potentialObjections: [{ objection: 'Too expensive', response: 'ROI in 3 months' }],
        meetingNoteExample: 'Ask about current vendor.',
        contactOverview: 'No enriched contacts.',
        readinessLevel: 'warm',
        documentUrl: 'https://blackpearl.example.com/pbk_1',
      });
    });

    it('falls back to the submitted company name when a succeeded result omits company_name', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          id: 'job-1',
          status: 'succeeded',
          input: { target_company: 'Acme Corp' },
          result: { business_summary: 'Some summary.' },
        }),
      );
      const provider = buildProvider();

      const result = await provider.getJobResult('job-1');

      expect(result?.status).toBe('completed');
      expect(result?.insight?.companyName).toBe('Acme Corp');
    });

    it('reports failed for a terminal non-success status (e.g. "failed")', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(200, { id: 'job-1', status: 'failed', error: 'model timeout' }),
      );
      const provider = buildProvider();

      await expect(provider.getJobResult('job-1')).resolves.toEqual(
        expect.objectContaining({ status: 'failed', insight: null }),
      );
    });

    it('reports failed for any unrecognized terminal status', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(200, { id: 'job-1', status: 'cancelled' }),
      );
      const provider = buildProvider();

      await expect(provider.getJobResult('job-1')).resolves.toEqual(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('returns null when the status check itself fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
      const provider = buildProvider();

      await expect(provider.getJobResult('job-1')).resolves.toBeNull();
    });

    it('treats a 503 as transient and recovers if a later attempt within the same call succeeds', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(jsonResponse(503, { detail: 'temporarily unavailable' }))
        .mockResolvedValueOnce(
          jsonResponse(200, {
            id: 'job-1',
            status: 'running',
            progress: 30,
            input: { target_company: 'Acme Corp' },
          }),
        );
      const provider = buildProvider();

      const result = await provider.getJobResult('job-1');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        jobId: 'job-1',
        status: 'pending',
        progress: 30,
        companyName: 'Acme Corp',
        insight: null,
      });
    });

    it('logs the complete 503 response - status, body, headers, job id, and a timestamp - without exposing the API key', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        jsonResponse(
          503,
          { detail: 'temporarily unavailable' },
          { 'retry-after': '5', 'x-request-id': 'req-abc123' },
        ),
      );
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const provider = buildProvider();

      await provider.getJobResult('job-1');

      const capturedCall = errorSpy.mock.calls.find((call) =>
        String(call[0]).includes('BlackPearl 503'),
      );
      expect(capturedCall).toBeDefined();

      const logged = String(capturedCall?.[0]);
      expect(logged).not.toContain('test-key');
      expect(logged).not.toContain('Bearer');

      const jsonStart = logged.indexOf('{');
      const captured = JSON.parse(logged.slice(jsonStart)) as {
        httpStatus: number;
        jobId: string;
        timestamp: string;
        responseHeaders: Record<string, string>;
        responseBody: string;
      };

      expect(captured.httpStatus).toBe(503);
      expect(captured.jobId).toBe('job-1');
      expect(new Date(captured.timestamp).toString()).not.toBe('Invalid Date');
      expect(captured.responseHeaders['retry-after']).toBe('5');
      expect(captured.responseHeaders['x-request-id']).toBe('req-abc123');
      expect(JSON.parse(captured.responseBody)).toEqual({
        detail: 'temporarily unavailable',
      });
    }, 15000);
  });

  describe('getPlaybook', () => {
    it('returns null immediately when unconfigured', async () => {
      global.fetch = jest.fn();
      const provider = buildProvider({ BLACKPEARL_API_KEY: undefined });

      await expect(provider.getPlaybook(COMPANY)).resolves.toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null if the job is still pending after the short-poll window', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(jsonResponse(202, { id: 'job-1', status: 'queued' }))
        .mockResolvedValue(jsonResponse(200, { id: 'job-1', status: 'running', progress: 10 }));
      const provider = buildProvider();

      await expect(provider.getPlaybook(COMPANY)).resolves.toBeNull();
    }, 15000);
  });
});
