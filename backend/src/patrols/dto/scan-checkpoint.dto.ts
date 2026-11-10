import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MAX_QR_CODE_VALUE_LENGTH } from '../checkpoint-verification.constants';

export class ScanCheckpointDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @IsIn(['completed', 'skipped'])
  status?: string;

  // Guard-submitted device location (Phase 3A). Deliberately NOT range
  // validated here (no @Min/@Max) - out-of-range or missing values are
  // classified server-side into a clean INVALID_LOCATION /
  // LOCATION_UNAVAILABLE result instead of a raw 400, so the guard always
  // gets one consistent response shape. The server never trusts a verdict
  // from the client - only these raw coordinates.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  // The raw string the guard's device decoded from the checkpoint's QR
  // sticker (or typed as a fallback). Same contract as the coordinates
  // above: this is evidence, not a verdict. The server compares it against
  // the checkpoint's own configured value and classifies the outcome
  // itself - a wrong or missing code is recorded and flagged, never
  // rejected, so a damaged sticker can't block a patrol. Length-capped so
  // a malformed decode isn't persisted verbatim.
  @IsOptional()
  @IsString()
  @MaxLength(MAX_QR_CODE_VALUE_LENGTH)
  qr_code_value?: string;
}
