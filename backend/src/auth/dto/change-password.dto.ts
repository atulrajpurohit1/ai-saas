import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../password-policy';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  // Shares the signup/reset policy via password-policy.ts, so an in-app change
  // can never set a password that signup would have rejected.
  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;

  // Present only on the second call when two-step verification is on: the
  // 6-digit code emailed by the first call. Omitted on the first call.
  @IsOptional()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Verification code must be 6 digits.' })
  code?: string;
}
