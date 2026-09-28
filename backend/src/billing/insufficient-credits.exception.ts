import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 402 Payment Required, raised when a tenant cannot afford a Prospect Search
 * job. Nest ships no PaymentRequiredException, and the status matters: a 402
 * is what lets the frontend tell "you have run out of credits" (offer a top-up)
 * apart from the 403 an entitlement failure raises ("you have not bought this
 * feature"). The `code` field is there so the frontend branches on a stable
 * string rather than matching on message text.
 */
export class InsufficientCreditsException extends HttpException {
  constructor(
    message: string,
    public readonly required: number,
    public readonly available: number,
  ) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'Payment Required',
        code: 'INSUFFICIENT_CREDITS',
        message,
        required,
        available,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
