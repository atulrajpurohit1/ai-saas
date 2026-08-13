"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GhlProvider = void 0;
const common_1 = require("@nestjs/common");
const crm_provider_interface_1 = require("./crm-provider.interface");
const AUTH_URL = 'https://marketplace.gohighlevel.com/v2/oauth/chooselocation';
const TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';
const CONTACTS_URL = 'https://services.leadconnectorhq.com/contacts/';
const UPSERT_CONTACT_URL = 'https://services.leadconnectorhq.com/contacts/upsert';
const API_VERSION = '2021-07-28';
const SCOPES = ['contacts.readonly', 'contacts.write'];
let GhlProvider = class GhlProvider {
    key = 'ghl';
    label = 'GoHighLevel';
    scopes = SCOPES;
    isConfigured() {
        return Boolean(this.clientId() && this.clientSecret() && this.redirectUri());
    }
    buildAuthUrl(state) {
        if (!this.isConfigured()) {
            throw new crm_provider_interface_1.CrmApiError(400, 'GHL OAuth environment variables are not configured');
        }
        const params = new URLSearchParams({
            response_type: 'code',
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
                user_type: 'Location',
                code,
            }),
        });
        if (!response.ok) {
            throw await this.toApiError(response, 'GHL token exchange failed');
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
                user_type: 'Location',
                refresh_token: refreshToken,
            }),
        });
        if (!response.ok) {
            throw await this.toApiError(response, 'GHL token refresh failed');
        }
        return response.json();
    }
    extractAccountMeta(token) {
        const locationId = token.locationId || null;
        return {
            portalId: locationId,
            externalAccountName: null,
        };
    }
    async fetchContacts(accessToken, locationId) {
        if (!locationId) {
            throw new crm_provider_interface_1.CrmApiError(400, 'Missing GHL location for this connection');
        }
        const url = new URL(CONTACTS_URL);
        url.searchParams.set('locationId', locationId);
        url.searchParams.set('limit', '100');
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Version: API_VERSION,
            },
        });
        if (!response.ok) {
            throw await this.toApiError(response, `GHL contact import failed: ${response.status}`);
        }
        const payload = (await response.json());
        return (payload.contacts || []).map((contact) => ({
            email: this.clean(contact.email),
            firstName: this.clean(contact.firstName),
            lastName: this.clean(contact.lastName),
            company: this.clean(contact.companyName),
            status: 'new',
        }));
    }
    async upsertContact(accessToken, locationId, contact) {
        if (!locationId) {
            throw new crm_provider_interface_1.CrmApiError(400, 'Missing GHL location for this connection');
        }
        const body = {
            locationId,
            email: contact.email,
            name: contact.name || undefined,
            companyName: contact.companyName || undefined,
            website: contact.website || undefined,
            city: contact.city || undefined,
            state: contact.state || undefined,
            country: contact.country || undefined,
            source: 'AegisLead Prospect Search',
            tags: ['aegislead-prospect-search'],
        };
        const response = await fetch(UPSERT_CONTACT_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Version: API_VERSION,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw await this.toApiError(response, 'GHL contact sync failed');
        }
        const payload = (await response.json());
        if (!payload.contact?.id) {
            throw new crm_provider_interface_1.CrmApiError(502, 'GHL did not return a contact id');
        }
        const noteBody = this.buildNote(contact);
        if (noteBody) {
            await this.addNote(accessToken, payload.contact.id, noteBody);
        }
        return { externalId: payload.contact.id, created: Boolean(payload.new) };
    }
    buildNote(contact) {
        const lines = [];
        if (contact.jobTitle)
            lines.push(`Title: ${contact.jobTitle}`);
        if (contact.linkedinUrl)
            lines.push(`LinkedIn: ${contact.linkedinUrl}`);
        if (contact.note)
            lines.push(contact.note);
        if (lines.length === 0)
            return null;
        return ['Synced from AegisLead Prospect Search.', ...lines].join('\n');
    }
    async addNote(accessToken, contactId, body) {
        const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Version: API_VERSION,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ body }),
        });
        if (!response.ok) {
            return;
        }
    }
    async toApiError(response, fallback) {
        let message = fallback;
        try {
            const body = (await response.json());
            if (Array.isArray(body.message)) {
                message = body.message.join('; ');
            }
            else if (typeof body.message === 'string') {
                message = body.message;
            }
        }
        catch {
        }
        return new crm_provider_interface_1.CrmApiError(response.status, message.slice(0, 500));
    }
    clean(value) {
        const trimmed = value?.trim();
        return trimmed || null;
    }
    clientId() {
        return process.env.GHL_CLIENT_ID || '';
    }
    clientSecret() {
        return process.env.GHL_CLIENT_SECRET || '';
    }
    redirectUri() {
        return process.env.GHL_REDIRECT_URI || '';
    }
};
exports.GhlProvider = GhlProvider;
exports.GhlProvider = GhlProvider = __decorate([
    (0, common_1.Injectable)()
], GhlProvider);
//# sourceMappingURL=ghl.provider.js.map