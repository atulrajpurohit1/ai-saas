import { Type } from 'class-transformer';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  MAX_GEOFENCE_RADIUS_METERS,
  MIN_GEOFENCE_RADIUS_METERS,
} from '../checkpoint-verification.constants';

export class CreateCheckpointDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  site_id: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location_note?: string;

  @IsOptional()
  @IsString()
  qr_code_value?: string;

  // GPS geofence (Phase 3A) - all optional; a checkpoint without these keeps
  // working, just without geofence verification (NO_GEOFENCE_CONFIGURED).
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_GEOFENCE_RADIUS_METERS)
  @Max(MAX_GEOFENCE_RADIUS_METERS)
  geofence_radius_meters?: number;
}
