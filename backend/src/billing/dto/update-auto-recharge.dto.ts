import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { CREDIT_PACK_KEYS, CreditPackKey } from '../credit-packs.constants';

export class UpdateAutoRechargeDto {
  @IsBoolean()
  enabled: boolean;

  /**
   * Buy when the balance is at or below this. The service additionally
   * refuses a threshold at or above the pack size, which would re-trigger
   * immediately after every top-up.
   */
  @IsInt()
  @Min(1)
  thresholdCredits: number;

  @IsIn(CREDIT_PACK_KEYS, { message: 'Unknown credit pack selected.' })
  packKey: CreditPackKey;

  /**
   * Ceiling on automatic spend per calendar month. Optional, but the point of
   * auto-recharge is that nobody is watching, so leaving it unset is worth a
   * deliberate choice.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  monthlyCapAmount?: number | null;
}
