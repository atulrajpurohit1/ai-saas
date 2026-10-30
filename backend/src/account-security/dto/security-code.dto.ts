import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

/** The 6-digit code confirming a security action (recovery email / 2FA). */
export class SecurityCodeDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Verification code must be 6 digits.' })
  code: string;
}
