import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RejectVendorDto {
  @IsString()
  @IsNotEmpty()
  vendorId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
