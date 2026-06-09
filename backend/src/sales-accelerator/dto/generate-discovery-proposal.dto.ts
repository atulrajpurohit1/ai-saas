import { IsOptional, IsString } from 'class-validator';

export class GenerateDiscoveryProposalDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  title?: string;
}
