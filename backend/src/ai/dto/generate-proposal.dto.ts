import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class GenerateProposalDto {
  @IsString()
  @IsNotEmpty()
  siteName: string;

  @IsNumber()
  guardCount: number;

  @IsString()
  @IsNotEmpty()
  requirements: string;

  @IsString()
  @IsOptional()
  additionalNotes?: string;
}
