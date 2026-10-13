import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 429, raised when ONE tenant has used more of our upstream BlackPearl spend
 * this month than their cap allows.
 *
 * Deliberately not InsufficientCreditsException. That 402 means "you have run
 * out of credits", and the UI answers it by offering a top-up -- which is
 * correct, because buying credits fixes it. This limit is ours, not theirs:
 * it caps what a single tenant can cost US in upstream compute, and no credit
 * purchase lifts it. Raising a 402 here would send the customer to buy credits
 * they then still could not spend.
 *
 * 429 rather than 403 because the condition is temporary and self-clearing:
 * `resetsAt` says when. The `code` is there so the frontend branches on a
 * stable string rather than matching on message text.
 */
export class UpstreamSpendCapExceededException extends HttpException {
  constructor(
    message: string,
    /** ISO timestamp at which the tenant's monthly window resets. */
    public readonly resetsAt: string,
  ) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        code: 'UPSTREAM_SPEND_CAP_EXCEEDED',
        message,
        resetsAt,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
