export declare const RATE_CARD_STATUSES: readonly ["active", "inactive"];
export type RateCardStatus = (typeof RATE_CARD_STATUSES)[number];
export declare class CreateRateCardDto {
    client_id: string;
    site_id?: string | null;
    role_name?: string;
    hourly_rate: number;
    overtime_rate?: number;
    holiday_rate?: number;
    effective_from: string;
    effective_to?: string;
    status?: RateCardStatus;
}
