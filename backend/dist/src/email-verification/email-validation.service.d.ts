export interface EmailValidationResult {
    valid: boolean;
    normalizedEmail: string;
    reason?: 'SYNTAX' | 'DISPOSABLE' | 'NO_MX_RECORD';
}
export declare class EmailValidationService {
    validate(rawEmail: string): Promise<EmailValidationResult>;
    normalize(rawEmail: string): string;
    private hasMailExchanger;
    private tryResolve;
    private withTimeout;
    private lookup;
}
