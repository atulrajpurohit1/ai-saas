import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../password-policy';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  resetToken: string;

  // Shares RegisterDto's policy via password-policy.ts, so reset can never
  // become a way to set a password that signup would have rejected.
  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
