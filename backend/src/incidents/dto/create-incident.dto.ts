import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsIn(INCIDENT_SEVERITIES)
  severity: IncidentSeverity;

  @IsISO8601()
  occurred_at: string;

  @IsString()
  @IsOptional()
  attachment_url?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
