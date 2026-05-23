import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class GuardLoginDto {
  @IsString()
  @IsOptional()
  identifier?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @MinLength(6)
  password: string;
}
