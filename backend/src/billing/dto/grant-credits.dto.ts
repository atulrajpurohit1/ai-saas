import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

/**
 * Manual credit adjustment by an admin -- a goodwill top-up, or a correction
 * after a support issue. Bounded in both directions so a mistyped figure cannot
 * mint or destroy an implausible balance.
 */
export class GrantCreditsDto {
  @IsInt({ message: 'Credit amount must be a whole number.' })
  @Min(-100_000)
  @Max(100_000)
  amount: number;

  @IsString()
  @IsNotEmpty({ message: 'Give a reason for this adjustment.' })
  reason: string;
}
