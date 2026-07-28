import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class InviteVendorsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  vendorIds: string[];
}
