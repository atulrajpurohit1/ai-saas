import { IsOptional, IsString, MaxLength } from 'class-validator';

// Shared by both the acknowledge and resolve endpoints - an optional note
// from the admin/dispatcher handling the alert. Never accepts guardId,
// tenantId, status, or timestamps - those are always derived server-side.
export class EmergencyAlertActionDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
