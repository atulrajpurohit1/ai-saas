import { IsOptional, IsString, IsUUID } from 'class-validator';

export class DialDto {
  /** The customer's number. Normalised to E.164 before dialling. */
  @IsString()
  toNumber!: string;

  /**
   * The rep's own phone, which RingCentral rings FIRST. Required because
   * RingOut is two-legged: without it the call would ring whichever admin
   * created the tenant's JWT credential, for every rep in the company.
   */
  @IsString()
  fromNumber!: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @IsUUID()
  dealId?: string;
}
