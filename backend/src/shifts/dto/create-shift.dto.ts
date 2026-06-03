import { IsNotEmpty, IsString, IsDateString, IsInt, Min, IsOptional } from 'class-validator';

export class CreateShiftDto {
  @IsString()
  @IsNotEmpty()
  siteId: string;

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @IsInt()
  @Min(1)
  requiredGuards: number;

  @IsString()
  @IsOptional()
  branch_id?: string | null;
}
