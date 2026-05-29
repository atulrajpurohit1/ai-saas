import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RespondInvoiceDisputeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  admin_response: string;
}

export class CloseInvoiceDisputeDto {
  @IsString()
  @IsOptional()
  @MaxLength(4000)
  admin_response?: string;
}
