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
 * First-login password set. The client has just authenticated with the
 * agency-generated temporary password, so no current password is asked for
 * again here; this endpoint is only honoured while the account is still flagged
 * mustChangePassword. Shares the global password policy via password-policy.ts.
 */
export class ClientSetInitialPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
