import { Logger } from '@nestjs/common';
import { fireAndForget } from './fire-and-forget.util';

describe('fireAndForget', () => {
  let logger: Logger;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    logger = new Logger('test');
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  /**
   * The whole point. `void somePromise()` with no handler attached is an
   * unhandled rejection, which terminates the Node process by default -- a
   * notification email failing must never take the API down.
   */
  it('swallows a rejection instead of leaving it unhandled', async () => {
    fireAndForget(
      () => Promise.reject(new Error('smtp down')),
      logger,
      'Welcome email',
    );

    // Let the rejection settle. If it were unhandled, the process-level
    // handler would fire rather than the logger.
    await new Promise((resolve) => setImmediate(resolve));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Welcome email failed: smtp down'),
    );
  });

  // Arguments are built inside the callback, so a throw while building them is
  // as likely as a rejection from the work itself -- and would be synchronous,
  // which a bare .catch() on the promise would not catch.
  it('catches a synchronous throw from the work itself', () => {
    expect(() =>
      fireAndForget(
        () => {
          throw new Error('bad argument');
        },
        logger,
        'Signup alert',
      ),
    ).not.toThrow();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Signup alert could not be started'),
    );
  });

  it('logs nothing when the work succeeds', async () => {
    fireAndForget(() => Promise.resolve({ sent: true }), logger, 'Alert');

    await new Promise((resolve) => setImmediate(resolve));
    expect(warn).not.toHaveBeenCalled();
  });

  // A rejection carrying a non-Error (a string, undefined) must not itself
  // throw inside the handler while trying to read `.message`.
  it('handles a non-Error rejection', async () => {
    fireAndForget(() => Promise.reject('just a string'), logger, 'Alert');

    await new Promise((resolve) => setImmediate(resolve));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('just a string'));
  });

  it('returns immediately rather than waiting for the work', () => {
    let settled = false;
    fireAndForget(
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            settled = true;
            resolve(undefined);
          }, 10),
        ),
      logger,
      'Slow work',
    );

    expect(settled).toBe(false);
  });
});
