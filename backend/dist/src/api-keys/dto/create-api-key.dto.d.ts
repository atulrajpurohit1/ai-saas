export declare class CreateApiKeyDto {
    name: string;
    permissions: string[];
    expires_at?: string;
    rate_limit_per_minute?: number;
}
