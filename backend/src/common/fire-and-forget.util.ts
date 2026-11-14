import { Logger } from '@nestjs/common';

/**
 * Starts work we deliberately do not wait for, and swallows any rejection.
 *
 * `void somePromise()` alone is NOT safe. If that promise rejects for a reason
 * its author did not anticipate, nothing is attached to handle it, and an
 * unhandled rejection terminates the Node process by default. A notification
 * email is never worth taking the API down for, so every fire-and-forget call
 * goes through here.
 *
 * This is belt-and-braces with the services' own error handling, on purpose:
 * the methods we call this way already catch internally and return a result
 * object. The point is that the CALLER must not depend on that staying true.
 * A later refactor that lets one throw before its try block -- or a synchronous
 * throw while building arguments -- should degrade to a log line, not a crash.
 *
 * Nothing here can throw: the work is invoked inside a try so a synchronous
 * throw is caught too, and the rejection handler only logs.
 */
export function fireAndForget(
  work: () => Promise<unknown>,
  logger: Logger,
  description: string,
): void {
  try {
    void work().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`${description} failed: ${message}`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`${description} could not be started: ${message}`);
  }
}
