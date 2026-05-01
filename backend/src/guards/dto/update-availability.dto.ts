import { IsEnum, IsOptional, IsDateString } from 'class-validator';

export class UpdateAvailabilityDto {
  @IsEnum(['available', 'unavailable'])
  status: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
