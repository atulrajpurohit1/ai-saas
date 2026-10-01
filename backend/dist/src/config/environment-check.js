"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDevelopmentLike = isDevelopmentLike;
exports.checkEnvironment = checkEnvironment;
exports.assertEnvironment = assertEnvironment;
const common_1 = require("@nestjs/common");
function isDevelopmentLike(env = process.env) {
    const value = env.NODE_ENV?.trim().toLowerCase();
    return value === 'development' || value === 'test' || value === 'local';
}
const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_SECRETS = new Set([
    'secret',
    'changeme',
    'change-me',
    'your-secret',
    'your-secret-here',
    'jwt-secret',
    'local-crm-token-secret',
    'test',
    'dev',
]);
function isWeakSecret(value) {
    const normalized = value.trim().toLowerCase();
    return (normalized.length < MIN_SECRET_LENGTH ||
        PLACEHOLDER_SECRETS.has(normalized));
}
function checkEnvironment(env = process.env) {
    const fatal = [];
    const warnings = [];
    const isProduction = !isDevelopmentLike(env);
    for (const key of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
        if (!env[key]?.trim()) {
            fatal.push(`${key} is not set.`);
        }
    }
    const accessSecret = env.JWT_ACCESS_SECRET?.trim();
    const refreshSecret = env.JWT_REFRESH_SECRET?.trim();
    if (accessSecret && refreshSecret && accessSecret === refreshSecret) {
        const message = 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are identical; the two token types must not share a signing key.';
        if (isProduction)
            fatal.push(message);
        else
            warnings.push(message);
    }
    for (const key of [
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET',
        'CRM_TOKEN_SECRET',
    ]) {
        const value = env[key]?.trim();
        if (value && isWeakSecret(value)) {
            const message = `${key} is shorter than ${MIN_SECRET_LENGTH} characters or is a known placeholder value.`;
            if (isProduction)
                fatal.push(message);
            else
                warnings.push(message);
        }
    }
    if (!env.NODE_ENV) {
        warnings.push('NODE_ENV is not set; it is being treated as production, which is the safe default (no OTP logging, no localhost CORS). Set NODE_ENV=production explicitly on a deployed service, or NODE_ENV=development locally to get the developer conveniences back.');
    }
    if (isProduction) {
        const hasMailProvider = env.BREVO_API_KEY?.trim() ||
            env.RESEND_API_KEY?.trim() ||
            env.SMTP_HOST?.trim();
        if (!hasMailProvider) {
            warnings.push('No mail provider configured (BREVO_API_KEY, RESEND_API_KEY or SMTP_HOST). Signup and password reset will fail, because neither can complete without delivering a code.');
        }
        if (!env.EMAIL_FROM?.trim()) {
            warnings.push('EMAIL_FROM is not set. Providers reject sends from an unverified address, so verification emails may not be delivered.');
        }
        if (!env.CRM_TOKEN_SECRET?.trim()) {
            warnings.push('CRM_TOKEN_SECRET is not set; stored CRM OAuth tokens fall back to being encrypted under JWT_ACCESS_SECRET. Rotating that secret will make existing CRM connections undecryptable.');
        }
        if (!env.CORS_ORIGINS?.trim() && !env.FRONTEND_URL?.trim()) {
            warnings.push('Neither CORS_ORIGINS nor FRONTEND_URL is set; only the origins hard-coded in main.ts will be accepted.');
        }
        if (env.STRIPE_SECRET_KEY?.trim() &&
            !env.BILLING_RETURN_URL?.trim() &&
            !env.FRONTEND_URL?.trim()) {
            warnings.push('Stripe is configured but neither BILLING_RETURN_URL nor FRONTEND_URL is set. Paying customers will be returned to http://localhost:3000 -- their own machine -- after checkout.');
        }
    }
    return { fatal, warnings };
}
function assertEnvironment(env = process.env) {
    const logger = new common_1.Logger('EnvironmentCheck');
    const { fatal, warnings } = checkEnvironment(env);
    for (const warning of warnings) {
        logger.warn(warning);
    }
    if (fatal.length > 0) {
        for (const problem of fatal) {
            logger.error(problem);
        }
        throw new Error(`Refusing to start: ${fatal.length} configuration problem(s) above must be fixed.`);
    }
}
//# sourceMappingURL=environment-check.js.map