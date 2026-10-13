import { Logger } from '@nestjs/common';
import {
  blackPearlRequest,
  blackPearlRequestOutcome,
} from './blackpearl-http.util';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as Response;
}

/** BlackPearl's failure envelope: `{ error: { code, message, request_id } }`. */
function errorBody(code: string, message = 'refused') {
  return {
    error: {
      code,
      message,
      request_id: 'req_abc123',
      docs_url: 'https://api.blackpearl.com/docs/errors',
    },
  };
}

describe('blackPearlRequestOutcome', () => {
  const originalFetch = global.fetch;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test');
    jest.spyOn(logger, 'log').mockImplementation();
    jest.spyOn(logger, 'warn').mockImplementation();
    jest.spyOn(logger, 'error').mockImplementation();
    jest.spyOn(logger, 'debug').mockImplementation();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const call = () =>
    blackPearlRequestOutcome<{ id: string }>(
      logger,
      'https://api.blackpearl.test/v1/prospects',
      { method: 'POST' },
      'submit a job',
    );

  it('returns the parsed body on success', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(202, { id: 'job-1' }));

    await expect(call()).resolves.toEqual({ ok: true, data: { id: 'job-1' } });
  });

  /**
   * The behaviour this type exists for. BlackPearl's own response
   * documentation says that of the 429s, "Only `rate_limit_exceeded` is
   * transient" -- so a hard budget that has already refused us must be
   * reported at once. It used to be retried twice with doubled backoff and
   * then reported as an indistinguishable null, which spent six seconds to
   * learn nothing and lost the one fact worth knowing.
   */
  it('does not retry a 429 raised by a hard budget', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(429, errorBody('budget_exceeded')));
    global.fetch = fetchMock;

    const outcome = await call();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({
      ok: false,
      failure: {
        kind: 'budget_exceeded',
        code: 'budget_exceeded',
        httpStatus: 429,
        message: 'refused',
        requestId: 'req_abc123',
      },
    });
  });

  it('does not retry a 429 raised by a usage quota', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(429, errorBody('quota_exceeded')));
    global.fetch = fetchMock;

    const outcome = await call();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.failure.kind).toBe('quota_exceeded');
  });

  it('retries a 429 that really is a rate limit', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(429, errorBody('rate_limit_exceeded')));
    global.fetch = fetchMock;

    const outcome = await call();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(outcome.ok === false && outcome.failure.kind).toBe('rate_limited');
  }, 20_000);

  /**
   * An unrecognised 429 is treated as a rate limit, which is the retryable
   * reading: guessing "hard ceiling" for a code we do not know would turn a
   * momentary throttle into an immediate failure.
   */
  it('retries a 429 whose body carries no error code', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(429, {}));
    global.fetch = fetchMock;

    const outcome = await call();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(outcome.ok === false && outcome.failure.kind).toBe('rate_limited');
  }, 20_000);

  /**
   * 402 is the shared organization pot running dry -- the condition that stops
   * every tenant at once. Reporting it as its own kind is what lets the caller
   * say so, instead of logging a generic failure.
   */
  it('reports an empty prepaid pot as insufficient_credits without retrying', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(402, errorBody('insufficient_credits')));
    global.fetch = fetchMock;

    const outcome = await call();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(outcome.ok === false && outcome.failure.kind).toBe(
      'insufficient_credits',
    );
  });

  it('classifies a 402 with an unreadable body from its status alone', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 402,
      headers: new Headers(),
      text: () => Promise.resolve('<html>gateway</html>'),
    } as Response);

    const outcome = await call();

    expect(outcome.ok === false && outcome.failure.kind).toBe(
      'insufficient_credits',
    );
    expect(outcome.ok === false && outcome.failure.code).toBeNull();
  });

  it('reports an auth failure without retrying', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(401, errorBody('invalid_api_key')));
    global.fetch = fetchMock;

    const outcome = await call();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(outcome.ok === false && outcome.failure.kind).toBe('auth');
  });

  it('reports a 404 without retrying', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(404, errorBody('not_found')));
    global.fetch = fetchMock;

    const outcome = await call();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(outcome.ok === false && outcome.failure.kind).toBe('not_found');
  });

  it('retries a 5xx and reports it as unavailable', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(500, {}));
    global.fetch = fetchMock;

    const outcome = await call();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(outcome.ok === false && outcome.failure.kind).toBe('unavailable');
  }, 20_000);
});

describe('blackPearlRequest', () => {
  const originalFetch = global.fetch;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test');
    jest.spyOn(logger, 'log').mockImplementation();
    jest.spyOn(logger, 'warn').mockImplementation();
    jest.spyOn(logger, 'error').mockImplementation();
    jest.spyOn(logger, 'debug').mockImplementation();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  /** The existing contract, unchanged for the call sites that only need it. */
  it('still returns the body on success and null on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(200, { id: 'x' }));
    await expect(
      blackPearlRequest(logger, 'https://x.test', { method: 'GET' }, 'read'),
    ).resolves.toEqual({ id: 'x' });

    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(429, errorBody('budget_exceeded')));
    await expect(
      blackPearlRequest(logger, 'https://x.test', { method: 'GET' }, 'read'),
    ).resolves.toBeNull();
  });
});
