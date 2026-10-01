import { IsIn } from 'class-validator';
import {
  GUARD_BANDS,
  GuardBand,
  PACKAGE_KEYS,
  PackageKey,
} from '../pricing.constants';

export class CreateCheckoutSessionDto {
  @IsIn(PACKAGE_KEYS, { message: 'Unknown package selected.' })
  package: PackageKey;

  @IsIn(GUARD_BANDS.map((band) => band.key), {
    message: 'Unknown guard band selected.',
  })
  band: GuardBand;
}
