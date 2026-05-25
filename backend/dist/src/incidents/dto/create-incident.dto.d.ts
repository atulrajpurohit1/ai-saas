export declare const INCIDENT_SEVERITIES: readonly ["low", "medium", "high", "critical"];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export declare class CreateIncidentDto {
    title: string;
    description: string;
    severity: IncidentSeverity;
    occurred_at: string;
    attachment_url?: string;
    notes?: string;
}
