import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  /** Optional; derived from the name when omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(48)
  slug?: string;

  @IsEmail()
  @IsNotEmpty()
  ownerEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerName?: string;

  /**
   * The owner's initial password. Twelve characters minimum, matching the
   * floor the admin seed script enforces -- an account created here has the
   * same reach over its tenant as one created by signup.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(12)
  @MaxLength(200)
  ownerPassword: string;
}
