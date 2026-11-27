import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PACKAGE_KEYS, PackageKey } from '../pricing.constants';
import { NO_PLAN_SALE_KEY } from '../sale-campaign.constants';

export class SaleCampaignDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsInt()
  @Min(0)
  @Max(100)
  percentOff: number;

  @IsInt()
  @Min(0)
  @Max(1000000)
  bonusCredits: number;

  @IsArray()
  @ArrayUnique()
  @IsIn([...PACKAGE_KEYS, NO_PLAN_SALE_KEY], { each: true })
  packageKeys: (PackageKey | typeof NO_PLAN_SALE_KEY)[];

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsBoolean()
  enabled: boolean;
}

export class SetSaleEnabledDto {
  @IsBoolean()
  enabled: boolean;
}
