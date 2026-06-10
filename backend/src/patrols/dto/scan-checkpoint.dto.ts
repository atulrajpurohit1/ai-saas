import { IsOptional, IsString, IsIn } from 'class-validator';

export class ScanCheckpointDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @IsIn(['completed', 'skipped'])
  status?: string;
}
