import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Every field is optional: a scheduler fixing a typo in the end time should
 * not have to resend the site. What may be changed depends on whether anyone
 * has checked in yet; ShiftsService.update enforces that.
 */
export class UpdateShiftDto {
  @IsString()
  @IsOptional()
  siteId?: string;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  requiredGuards?: number;
}
