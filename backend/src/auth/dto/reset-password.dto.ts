import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  resetToken: string;

  // Matches RegisterDto's password policy (MinLength(8)) — the existing
  // signup password requirement, reused so reset doesn't invent a second
  // policy.
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
