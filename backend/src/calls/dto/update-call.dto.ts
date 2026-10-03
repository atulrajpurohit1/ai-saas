import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CALL_OUTCOMES, type CallOutcome } from './log-call.dto';

/**
 * A rep updates a call after the fact -- the dial is logged the moment the
 * dialer opens, but outcome, duration and notes are only knowable once they
 * hang up. The phone number is deliberately not updatable: it records what was
 * actually dialed.
 */
export class UpdateCallDto {
  @IsIn(CALL_OUTCOMES)
  @IsOptional()
  outcome?: CallOutcome;

  @IsInt()
  @Min(0)
  @Max(86400)
  @IsOptional()
  durationSec?: number;

  @IsString()
  @MaxLength(5000)
  @IsOptional()
  notes?: string;

  @IsString()
  @MaxLength(200000)
  @IsOptional()
  transcript?: string;
}
