import { IsNotEmpty, IsString } from 'class-validator';

/** Re-authenticates the current user before a sensitive security change. */
export class ConfirmPasswordDto {
  @IsString()
  @IsNotEmpty()
  password: string;
}
