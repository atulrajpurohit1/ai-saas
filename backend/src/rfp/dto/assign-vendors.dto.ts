import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AssignVendorsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  vendorIds: string[];
}
