import { Type } from 'class-transformer';
import { IsISO8601, IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from 'class-validator';

// Unlike ScanCheckpointDto (Phase 3A), a location ping carries no other
// operational meaning on its own - if the coordinates are invalid there is
// nothing useful to record, so this DTO validates strictly (400 on bad
// input) rather than degrading to a soft status.
export class UpdateLocationDto {
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  // Device-reported accuracy in meters, if available.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50_000)
  accuracy?: number;

  // Client-reported capture time, if available - falls back to server time.
  @IsOptional()
  @IsISO8601()
  timestamp?: string;
}
