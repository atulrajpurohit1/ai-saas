import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  MAX_GEOFENCE_RADIUS_METERS,
  MIN_GEOFENCE_RADIUS_METERS,
} from '../checkpoint-verification.constants';

export class UpdateCheckpointDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location_note?: string;

  @IsOptional()
  @IsString()
  qr_code_value?: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'inactive'])
  status?: string;

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

  // Allows an admin to explicitly clear a previously-configured geofence
  // without needing separate DELETE plumbing.
  @IsOptional()
  @IsBoolean()
  clear_geofence?: boolean;
}
