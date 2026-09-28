import { IsIn } from 'class-validator';
import { CREDIT_PACK_KEYS, CreditPackKey } from '../credit-packs.constants';

export class PurchaseCreditsDto {
  @IsIn(CREDIT_PACK_KEYS, { message: 'Unknown credit pack selected.' })
  pack: CreditPackKey;
}
