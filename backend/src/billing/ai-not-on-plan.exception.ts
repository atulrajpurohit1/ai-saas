import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 403 Forbidden, raised when a tenant tries to use an AI (Gemini) feature that
 * their plan does not include -- in practice, a tenant on the AegisLead Trial
 * plan, which grants everything except the AI features.
 *
 * Deliberately a 403 with its own `code`, not the 402 that a credit shortfall
 * raises: the two are different conversations. A 402 means "buy more credits"
 * and the frontend offers a top-up; this means "AI is not on your plan" and the
 * frontend offers an upgrade, never a top-up -- buying credits would not unlock
 * it. The `code` lets the frontend branch on a stable string, not message text.
 */
export class AiNotOnPlanException extends HttpException {
  constructor(
    message = 'AI features are not included in your plan. Upgrade to a paid plan to use them.',
  ) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        code: 'AI_NOT_ON_PLAN',
        message,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
