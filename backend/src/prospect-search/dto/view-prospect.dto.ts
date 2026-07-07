import { IsNotEmpty, IsString } from 'class-validator';

export class ViewProspectDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  companyName: string;
}
