import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Outcomes a rep can report. "dialed" is the default a record starts at. */
export const CALL_OUTCOMES = [
  'dialed',
  'connected',
  'no_answer',
  'voicemail',
  'wrong_number',
  'failed',
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export class LogCallDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsOptional()
  leadId?: string;

  @IsString()
  @IsOptional()
  dealId?: string;

  @IsIn(CALL_OUTCOMES)
  @IsOptional()
  outcome?: CallOutcome;

  /**
   * Rep-reported, so it is bounded rather than trusted. 24h is an absurd call
   * length, but it is a typo ceiling, not a claim that calls run that long.
   */
  @IsInt()
  @Min(0)
  @Max(86400)
  @IsOptional()
  durationSec?: number;

  @IsString()
  @MaxLength(5000)
  @IsOptional()
  notes?: string;
}
