export declare class GenerateInvoiceDto {
    client_id: string;
    site_id?: string;
    billing_start_date: string;
    billing_end_date: string;
    hourly_rate?: number;
    allow_manual_rate?: boolean;
}
