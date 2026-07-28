import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AwardContractDto {
  @IsString()
  @IsNotEmpty()
  vendorId: string;

  @IsOptional()
  @IsString()
  awardNotes?: string;
}
