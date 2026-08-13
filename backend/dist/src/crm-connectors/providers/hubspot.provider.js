"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HubspotProvider = void 0;
const common_1 = require("@nestjs/common");
const AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';
const CONTACTS_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';
const SCOPES = ['crm.objects.contacts.read'];
let HubspotProvider = class HubspotProvider {
    key = 'hubspot';
    label = 'HubSpot';
    scopes = SCOPES;
    isConfigured() {
        return Boolean(this.clientId() && this.clientSecret() && this.redirectUri());
    }
    buildAuthUrl(state) {
        if (!this.isConfigured()) {
            throw new common_1.BadRequestException('HubSpot OAuth environment variables are not configured');
        }
        const params = new URLSearchParams({
            client_id: this.clientId(),
            redirect_uri: this.redirectUri(),
            scope: SCOPES.join(' '),
            state,
        });
        return `${AUTH_URL}?${params.toString()}`;
    }
    async exchangeCode(code) {
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: this.clientId(),
                client_secret: this.clientSecret(),
                redirect_uri: this.redirectUri(),
                code,
            }),
        });
        if (!response.ok) {
            throw new common_1.BadRequestException('HubSpot token exchange failed');
        }
        return response.json();
    }
    async refreshToken(refreshToken) {
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: this.clientId(),
                client_secret: this.clientSecret(),
                refresh_token: refreshToken,
            }),
        });
        if (!response.ok) {
            throw new common_1.BadRequestException('HubSpot token refresh failed');
        }
        return response.json();
    }
    extractAccountMeta(token) {
        return {
            portalId: token.hub_id ? String(token.hub_id) : null,
            externalAccountName: token.hub_domain || null,
        };
    }
    async fetchContacts(accessToken) {
        const url = new URL(CONTACTS_URL);
        url.searchParams.set('limit', '100');
        url.searchParams.set('properties', 'firstname,lastname,email,company,hs_lead_status');
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            const message = await response.text();
            throw new common_1.BadRequestException(message || `HubSpot contact import failed: ${response.status}`);
        }
        const payload = (await response.json());
        return (payload.results || []).map((contact) => {
            const properties = contact.properties || {};
            return {
                email: this.clean(properties.email),
                firstName: this.clean(properties.firstname),
                lastName: this.clean(properties.lastname),
                company: this.clean(properties.company),
                status: this.clean(properties.hs_lead_status)?.toLowerCase() || 'new',
            };
        });
    }
    clean(value) {
        const trimmed = value?.trim();
        return trimmed || null;
    }
    clientId() {
        return process.env.HUBSPOT_CLIENT_ID || '';
    }
    clientSecret() {
        return process.env.HUBSPOT_CLIENT_SECRET || '';
    }
    redirectUri() {
        return process.env.HUBSPOT_REDIRECT_URI || '';
    }
};
exports.HubspotProvider = HubspotProvider;
exports.HubspotProvider = HubspotProvider = __decorate([
    (0, common_1.Injectable)()
], HubspotProvider);
//# sourceMappingURL=hubspot.provider.js.map