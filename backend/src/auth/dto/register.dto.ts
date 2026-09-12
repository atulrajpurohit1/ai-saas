import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

// A single, consistent user-facing message for any email-shape problem —
// whether caught here by class-validator or later by EmailVerificationService
// (disposable domain / unresolvable domain). Never let internal validation
// detail leak into the response.
const INVALID_EMAIL_MESSAGE = 'Please enter a valid email address.';

export class RegisterDto {
  @IsEmail({}, { message: INVALID_EMAIL_MESSAGE })
  @IsNotEmpty({ message: INVALID_EMAIL_MESSAGE })
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  tenantName: string;
}
