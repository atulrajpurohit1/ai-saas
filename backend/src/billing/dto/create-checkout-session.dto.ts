import { IsIn, IsOptional } from 'class-validator';
import {
  GUARD_BANDS,
  GuardBand,
  PACKAGE_KEYS,
  PackageKey,
} from '../pricing.constants';
import {
  LEAD_GEN_TIER_KEYS,
  LeadGenTierKey,
} from '../lead-gen-tiers.constants';

export class CreateCheckoutSessionDto {
  @IsIn(PACKAGE_KEYS, { message: 'Unknown package selected.' })
  package: PackageKey;

  @IsIn(GUARD_BANDS.map((band) => band.key), {
    message: 'Unknown guard band selected.',
  })
  band: GuardBand;

  /**
   * Which Lead Gen plan to buy. Required for GENERATION, which is sold as
   * flat-priced tiers with a credit allocation rather than by guard band, and
   * ignored for every other package. The band above is still sent for
   * GENERATION by older clients; it is not what sets the price.
   */
  @IsOptional()
  @IsIn(LEAD_GEN_TIER_KEYS, { message: 'Unknown Lead Gen plan selected.' })
  tier?: LeadGenTierKey;
}
