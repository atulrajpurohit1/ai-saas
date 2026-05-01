import { IsNotEmpty, IsString, IsDateString, IsInt, Min } from 'class-validator';

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
}
