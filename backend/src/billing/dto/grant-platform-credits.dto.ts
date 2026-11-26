import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GrantPlatformCreditsDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
