export declare class PublicApiRateLimitService {
    private readonly windows;
    check(apiKeyId: string, limit: number): void;
    private cleanup;
}
