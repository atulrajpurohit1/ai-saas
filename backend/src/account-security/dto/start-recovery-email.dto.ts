import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class StartRecoveryEmailDto {
  @IsString()
  @IsNotEmpty()
  password: string;

  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @IsNotEmpty()
  email: string;
}
