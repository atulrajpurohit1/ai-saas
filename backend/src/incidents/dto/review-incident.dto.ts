import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const INCIDENT_REVIEW_STATUSES = ['approved', 'rejected'] as const;
export type IncidentReviewStatus = (typeof INCIDENT_REVIEW_STATUSES)[number];

export class ReviewIncidentDto {
  @IsIn(INCIDENT_REVIEW_STATUSES)
  status: IncidentReviewStatus;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  review_note?: string;
}
