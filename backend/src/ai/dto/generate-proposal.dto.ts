import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class GenerateProposalDto {
  @IsString()
  @IsNotEmpty()
  siteName: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  guardCount: number;

  @IsString()
  @IsNotEmpty()
  requirements: string;

  @IsString()
  @IsOptional()
  additionalNotes?: string;
}
