import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProposalDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  leadId?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  dealId?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  clientId?: string;
}
