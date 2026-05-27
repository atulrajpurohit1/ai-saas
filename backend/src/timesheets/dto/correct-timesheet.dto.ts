import { Type } from 'class-transformer';
import { IsISO8601, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CorrectTimesheetDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total_hours: number;

  @IsOptional()
  @IsISO8601()
  check_in_time?: string;

  @IsOptional()
  @IsISO8601()
  check_out_time?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  correction_reason?: string;
}
