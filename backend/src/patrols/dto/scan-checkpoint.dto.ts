import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

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
}
