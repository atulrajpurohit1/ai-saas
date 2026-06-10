import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CoachDiscoveryCallDto {
  @IsOptional()
  @IsString()
  @MaxLength(30000)
  transcript?: string;
}
