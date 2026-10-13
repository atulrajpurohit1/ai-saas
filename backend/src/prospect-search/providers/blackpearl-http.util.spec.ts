import { Logger } from '@nestjs/common';
import {
  BLACKPEARL_TERMINAL_BUDGET_CODES,
  blackPearlRequest,
  type BlackPearlRequestOutcome,
} from './blackpearl-http.util';

function errorResponse(status: number, code?: string) {
  const body = code
    ? { error: { code, message: `simulated ${code}` } }
    : { message: 'no code here' };
  return {
    ok: false,
    status,
    headers: new Headers(),
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as Response;
}

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as Response;
}

/**
 * A 429 from BlackPearl carries three different meanings and only
 * `rate_limit_exceeded` is transient. Retrying the other two burned three
 * requests and seconds of backoff before failing, and then reported the same
 * "transient failure" as a genuine outage -- so a tenant that had simply run
 * out of budget produced a 503 that looked like BlackPearl being down.
 *
 * These tests pin the distinction, because getting it wrong is invisible in
 * normal operation and only shows up as a misdiagnosed incident.
 */
describe('blackPearlRequest budget handling', () => {
  const originalFetch = global.fetch;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test');
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    jest.spyOn(logger, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it.each(['budget_exceeded', 'quota_exceeded'])(
    'does not retry a 429 %s, and reports the code',
    async (code) => {
      const fetchMock = jest.fn().mockResolvedValue(errorResponse(429, code));
      global.fetch = fetchMock;

      const outcome: BlackPearlRequestOutcome = {};
      const result = await blackPearlRequest(
        logger,
        'https://example.test/v1/prospects',
        { method: 'POST' },
        'submit',
        undefined,
        outcome,
      );

      expect(result).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(outcome.errorCode).toBe(code);
    },
  );

  it('still retries a 429 rate_limit_exceeded, which IS transient', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(errorResponse(429, 'rate_limit_exceeded'))
      .mockResolvedValue(okResponse({ id: 'job-1' }));
    global.fetch = fetchMock;

    const outcome: BlackPearlRequestOutcome = {};
    const result = await blackPearlRequest<{ id: string }>(
      logger,
      'https://example.test/v1/prospects',
      { method: 'POST' },
      'submit',
      undefined,
      outcome,
    );

    expect(result).toEqual({ id: 'job-1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // A recovered rate limit is not a budget problem, so nothing is reported.
    expect(outcome.errorCode).toBeUndefined();
  });

  it('retries a 429 whose code cannot be read, rather than failing the search', async () => {
    const fetchMock = jest.fn().mockResolvedValue(errorResponse(429));
    global.fetch = fetchMock;

    const result = await blackPearlRequest(
      logger,
      'https://example.test/v1/prospects',
      { method: 'POST' },
      'submit',
    );

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // Real backoff is exercised here (doubled for a 429), so this case needs
    // more than Jest's default 5s budget.
  }, 20_000);

  it('does not retry a 402, and reports insufficient_credits', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(errorResponse(402, 'insufficient_credits'));
    global.fetch = fetchMock;

    const outcome: BlackPearlRequestOutcome = {};
    const result = await blackPearlRequest(
      logger,
      'https://example.test/v1/prospects',
      { method: 'POST' },
      'submit',
      undefined,
      outcome,
    );

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(outcome.errorCode).toBe('insufficient_credits');
  });

  it('treats a 402 with an unreadable body as insufficient_credits anyway', async () => {
    global.fetch = jest.fn().mockResolvedValue(errorResponse(402));

    const outcome: BlackPearlRequestOutcome = {};
    await blackPearlRequest(
      logger,
      'https://example.test/v1/prospects',
      { method: 'POST' },
      'submit',
      undefined,
      outcome,
    );

    expect(outcome.errorCode).toBe('insufficient_credits');
  });

  it('still retries 5xx, which the budget branch must not have broken', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValue(okResponse({ id: 'job-2' }));
    global.fetch = fetchMock;

    const result = await blackPearlRequest<{ id: string }>(
      logger,
      'https://example.test/v1/jobs/x',
      { method: 'GET' },
      'poll',
    );

    expect(result).toEqual({ id: 'job-2' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('scopes insufficient_credits to the company and allowances to the tenant', () => {
    // The scope decides whether the customer is asked to top up or an
    // operator is paged, so it is worth pinning rather than inferring.
    //
    // A budget or quota stop is one client's allowance or limit: BlackPearl
    // stops only that client. An exhausted prepaid balance is shared fate,
    // and per-client projects do not change that -- the company balance funds
    // every project.
    expect(BLACKPEARL_TERMINAL_BUDGET_CODES.insufficient_credits).toBe(
      'company',
    );
    expect(BLACKPEARL_TERMINAL_BUDGET_CODES.budget_exceeded).toBe('tenant');
    expect(BLACKPEARL_TERMINAL_BUDGET_CODES.quota_exceeded).toBe('tenant');
  });
});
