import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DisputeInvoiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description: string;
}
