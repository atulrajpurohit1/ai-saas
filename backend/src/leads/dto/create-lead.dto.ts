import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  company: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
