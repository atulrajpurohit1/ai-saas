import { IsOptional, IsString } from 'class-validator';

// Phase 3H: the only client-supplied value is an optional clientId to link the
// resulting draft proposal to. It is re-validated against the caller's tenant
// by ProposalsService. tenantId / userId are always taken from the JWT.
export class GenerateRfpProposalDto {
  @IsOptional()
  @IsString()
  clientId?: string;
}
