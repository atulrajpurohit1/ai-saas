import { IsISO8601, IsNotEmpty, IsString } from 'class-validator';

export class GenerateDailyReportDto {
  @IsString()
  @IsNotEmpty()
  site_id: string;

  @IsISO8601()
  report_date: string;
}
