import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../auth/password-policy';

/** Matches RegisterDto: any email-shape problem gets one user-facing message,
 *  so nothing about the internal validation leaks into the response. */
const INVALID_EMAIL_MESSAGE = 'Please enter a valid email address.';

/**
 * Adds a team member to the caller's own tenant.
 *
 * This is the only way a second person joins an existing account. Signing up
 * through /auth/register always creates a NEW tenant with the registrant as
 * its owner, so before this existed an owner had no way to bring a colleague
 * into their company at all -- the roles screen could only assign roles to
 * users who were somehow already there.
 *
 * The admin sets the password and hands it over, rather than the product
 * emailing an invitation link. That is a deliberate trade: it works without
 * deliverable email, it is what a small operations team actually does, and it
 * keeps the whole flow on one screen. The cost is that the password is known
 * to whoever created the account, which is why `mustChangePassword` is the
 * obvious next step if this grows.
 */
export class CreateTenantUserDto {
  @IsEmail({}, { message: INVALID_EMAIL_MESSAGE })
  @IsNotEmpty({ message: INVALID_EMAIL_MESSAGE })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Enter the person’s name.' })
  @MaxLength(120)
  name: string;

  /**
   * Bounded by the shared password policy, not by rules of its own: an
   * admin-created account must not be allowed a weaker password than one the
   * user picks for themselves.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;

  /** The role they start with. Required: a user with no role can sign in and
   *  do nothing, which reads as a broken account rather than a careful one. */
  @IsString()
  @IsNotEmpty({ message: 'Choose a role for this user.' })
  role_id: string;

  /** Branch to scope them to. Omit for someone who works across all of them. */
  @IsOptional()
  @IsString()
  branch_id?: string | null;
}
