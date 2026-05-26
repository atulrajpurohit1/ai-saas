export declare const INCIDENT_REVIEW_STATUSES: readonly ["approved", "rejected"];
export type IncidentReviewStatus = (typeof INCIDENT_REVIEW_STATUSES)[number];
export declare class ReviewIncidentDto {
    status: IncidentReviewStatus;
    review_note?: string;
}
