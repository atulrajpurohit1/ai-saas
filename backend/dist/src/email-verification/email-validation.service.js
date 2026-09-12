"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailValidationService = void 0;
const common_1 = require("@nestjs/common");
const dns_1 = require("dns");
const disposable_email_domains_1 = __importDefault(require("disposable-email-domains"));
const EMAIL_SYNTAX_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const DISPOSABLE_DOMAINS = new Set(disposable_email_domains_1.default.map((d) => d.toLowerCase()));
const FALLBACK_DNS_SERVERS = ['1.1.1.1', '8.8.8.8'];
const DNS_LOOKUP_TIMEOUT_MS = 900;
const TIMEOUT_SENTINEL = Symbol('dns-lookup-timeout');
let EmailValidationService = class EmailValidationService {
    async validate(rawEmail) {
        const normalizedEmail = this.normalize(rawEmail);
        if (!normalizedEmail ||
            normalizedEmail.length > 254 ||
            !EMAIL_SYNTAX_RE.test(normalizedEmail)) {
            return { valid: false, normalizedEmail, reason: 'SYNTAX' };
        }
        const domain = normalizedEmail.split('@')[1];
        if (DISPOSABLE_DOMAINS.has(domain)) {
            return { valid: false, normalizedEmail, reason: 'DISPOSABLE' };
        }
        const hasMx = await this.hasMailExchanger(domain);
        if (!hasMx) {
            return { valid: false, normalizedEmail, reason: 'NO_MX_RECORD' };
        }
        return { valid: true, normalizedEmail };
    }
    normalize(rawEmail) {
        return (rawEmail || '').trim().toLowerCase();
    }
    async hasMailExchanger(domain) {
        const mx = await this.tryResolve(domain, 'MX');
        if (mx === 'found')
            return true;
        if (mx === 'unresolvable') {
            const a = await this.tryResolve(domain, 'A');
            if (a === 'found')
                return true;
            if (a === 'unresolvable') {
                const aaaa = await this.tryResolve(domain, 'AAAA');
                if (aaaa === 'found')
                    return true;
                if (aaaa === 'unresolvable')
                    return false;
            }
        }
        const fallbackMx = await this.tryResolve(domain, 'MX', FALLBACK_DNS_SERVERS);
        if (fallbackMx === 'found')
            return true;
        if (fallbackMx === 'unresolvable') {
            const fallbackA = await this.tryResolve(domain, 'A', FALLBACK_DNS_SERVERS);
            if (fallbackA === 'found')
                return true;
            if (fallbackA === 'unresolvable')
                return false;
        }
        return true;
    }
    async tryResolve(domain, type, useServers) {
        try {
            const records = await this.withTimeout(this.lookup(domain, type, useServers));
            return records.length > 0 ? 'found' : 'unresolvable';
        }
        catch (error) {
            if (error === TIMEOUT_SENTINEL) {
                return 'unknown';
            }
            const code = error?.code;
            if (code === 'ENOTFOUND' ||
                code === 'ENODATA' ||
                ((code === 'ECONNREFUSED' || code === 'ECONNRESET') && useServers)) {
                return 'unresolvable';
            }
            return 'unknown';
        }
    }
    withTimeout(promise) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(TIMEOUT_SENTINEL), DNS_LOOKUP_TIMEOUT_MS);
            promise.then((value) => {
                clearTimeout(timer);
                resolve(value);
            }, (error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    lookup(domain, type, useServers) {
        if (!useServers) {
            if (type === 'MX')
                return dns_1.promises.resolveMx(domain);
            if (type === 'A')
                return dns_1.promises.resolve(domain);
            return dns_1.promises.resolve6(domain);
        }
        const resolver = new dns_1.Resolver();
        resolver.setServers(useServers);
        return new Promise((resolve, reject) => {
            const callback = (err, records) => {
                if (err)
                    reject(err);
                else
                    resolve(records || []);
            };
            if (type === 'MX')
                resolver.resolveMx(domain, callback);
            else if (type === 'A')
                resolver.resolve4(domain, callback);
            else
                resolver.resolve6(domain, callback);
        });
    }
};
exports.EmailValidationService = EmailValidationService;
exports.EmailValidationService = EmailValidationService = __decorate([
    (0, common_1.Injectable)()
], EmailValidationService);
//# sourceMappingURL=email-validation.service.js.map