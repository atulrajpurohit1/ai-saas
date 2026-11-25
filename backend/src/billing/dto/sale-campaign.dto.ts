import {
  ArrayNotEmpty,
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
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(PACKAGE_KEYS, { each: true })
  packageKeys: PackageKey[];

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
