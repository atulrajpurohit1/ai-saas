import { Logger } from '@nestjs/common';
export declare const BLACKPEARL_REQUEST_TIMEOUT_MS = 10000;
export declare function blackPearlRequest<T>(logger: Logger, url: string, init: RequestInit, context: string, jobId?: string): Promise<T | null>;
export declare function blackPearlHeaders(apiKey: string): Record<string, string>;
export declare function sleep(ms: number): Promise<void>;
export declare function normalizeString(value: string | null | undefined): string | undefined;
