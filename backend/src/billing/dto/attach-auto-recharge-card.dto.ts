import { IsString, MaxLength, MinLength } from 'class-validator';

export class AttachAutoRechargeCardDto {
  /** The Stripe Checkout session id returned by the card-setup flow. */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  sessionId: string;
}
