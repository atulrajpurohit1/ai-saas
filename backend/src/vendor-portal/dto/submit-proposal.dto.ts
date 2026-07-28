import { IsOptional, IsString } from 'class-validator';

export class SubmitProposalDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
