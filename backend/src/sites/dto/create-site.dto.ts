import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSiteDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}
