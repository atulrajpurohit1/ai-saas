import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../auth/password-policy';

/**
 * Changing the password from inside the portal while signed in. Requires the
 * current password so a walked-up, already-authenticated session cannot silently
 * change the credential. Shares the global password policy via password-policy.ts.
 */
export class ClientChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
