"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBlockedAddress = isBlockedAddress;
exports.assertPublicHttpUrl = assertPublicHttpUrl;
const common_1 = require("@nestjs/common");
const promises_1 = require("dns/promises");
const net_1 = require("net");
const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    'metadata.google.internal',
    'metadata',
    'instance-data',
]);
function isBlockedAddress(ip) {
    const version = (0, net_1.isIP)(ip);
    if (version === 4) {
        const parts = ip.split('.').map(Number);
        const [a, b] = parts;
        if (a === 0)
            return true;
        if (a === 10)
            return true;
        if (a === 127)
            return true;
        if (a === 169 && b === 254)
            return true;
        if (a === 172 && b >= 16 && b <= 31)
            return true;
        if (a === 192 && b === 168)
            return true;
        if (a === 100 && b >= 64 && b <= 127)
            return true;
        if (a === 192 && b === 0)
            return true;
        if (a >= 224)
            return true;
        return false;
    }
    if (version === 6) {
        const normalized = ip.toLowerCase();
        if (normalized === '::' || normalized === '::1')
            return true;
        const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped)
            return isBlockedAddress(mapped[1]);
        if (normalized.startsWith('fe80'))
            return true;
        if (/^f[cd]/.test(normalized))
            return true;
        if (normalized.startsWith('ff'))
            return true;
        return false;
    }
    return true;
}
async function assertPublicHttpUrl(rawUrl) {
    let url;
    try {
        url = new URL(rawUrl);
    }
    catch {
        throw new common_1.BadRequestException('Webhook URL is not a valid URL.');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new common_1.BadRequestException('Webhook URL must use http or https.');
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
        throw new common_1.BadRequestException('Webhook URL must point to a public address.');
    }
    if ((0, net_1.isIP)(hostname)) {
        if (isBlockedAddress(hostname)) {
            throw new common_1.BadRequestException('Webhook URL must point to a public address.');
        }
        return url;
    }
    let addresses;
    try {
        addresses = await (0, promises_1.lookup)(hostname, { all: true });
    }
    catch {
        throw new common_1.BadRequestException('Webhook URL host could not be resolved.');
    }
    if (addresses.length === 0 ||
        addresses.some((entry) => isBlockedAddress(entry.address))) {
        throw new common_1.BadRequestException('Webhook URL must point to a public address.');
    }
    return url;
}
//# sourceMappingURL=ssrf-guard.js.map