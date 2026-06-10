import { IsString, MaxLength, MinLength } from 'class-validator';

export class AnalyzeDiscoveryCallDto {
  @IsString()
  @MinLength(20)
  @MaxLength(30000)
  transcript: string;
}
