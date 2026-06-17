import api from '@/lib/api';

export interface PublicApiPermissionDefinition {
  key: string;
  name: string;
  description: string;
  group: string;
}

export interface ApiKeyRecord {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  masked_key: string;
  permissions: string[];
  status: string;
  expires_at?: string | null;
  rate_limit_per_minute: number;
  last_used_at?: string | null;
  created_at: string;
  updated_at?: string;
  requests_last_24h: number;
  api_key?: string;
}

export interface WebhookRecord {
  id: string;
  event_type: string;
  endpoint_url: string;
  secret_prefix?: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  delivery_count: number;
  latest_delivery?: WebhookDelivery | null;
  secret_key?: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type?: string;
  endpoint_url?: string;
  payload?: unknown;
  response_status?: number | null;
  success: boolean;
  retry_count: number;
  last_error?: string | null;
  created_at: string;
  delivered_at?: string | null;
}

export interface IntegrationOverview {
  active_integrations: { type: string; label: string; active: number }[];
  api_usage: { requests_last_24h: number };
  webhook_status: {
    id: string;
    event_type: string;
    endpoint_url: string;
    status: string;
    success_count: number;
    failure_count: number;
    latest_delivery_at?: string | null;
  }[];
  delivery_logs: WebhookDelivery[];
  request_logs: {
    id: string;
    api_key_id: string;
    api_key_name: string;
    key_prefix: string;
    endpoint: string;
    method: string;
    status_code: number;
    ip_address?: string | null;
    user_agent?: string | null;
    created_at: string;
  }[];
  failures_last_24h: number;
}

export interface CrmConnectorStatus {
  hubspot: {
    configured: boolean;
    connected: boolean;
    status: string;
    portal_id?: string | null;
    external_account_name?: string | null;
    scopes: string[];
    token_expires_at?: string | null;
    last_sync_at?: string | null;
    last_error?: string | null;
  };
}

export async function getIntegrationOverview() {
  const res = await api.get<IntegrationOverview>('integrations');
  return res.data;
}

export async function getApiKeyPermissions() {
  const res = await api.get<PublicApiPermissionDefinition[]>('api-keys/permissions');
  return res.data;
}

export async function getApiKeys() {
  const res = await api.get<ApiKeyRecord[]>('api-keys');
  return res.data;
}

export async function createApiKey(data: {
  name: string;
  permissions: string[];
  expires_at?: string;
  rate_limit_per_minute?: number;
}) {
  const res = await api.post<ApiKeyRecord>('api-keys', data);
  return res.data;
}

export async function updateApiKey(id: string, data: {
  name?: string;
  permissions?: string[];
  expires_at?: string;
  status?: string;
  rate_limit_per_minute?: number;
}) {
  const res = await api.patch<ApiKeyRecord>(`api-keys/${id}`, data);
  return res.data;
}

export async function revokeApiKey(id: string) {
  const res = await api.post<ApiKeyRecord>(`api-keys/${id}/revoke`);
  return res.data;
}

export async function regenerateApiKey(id: string) {
  const res = await api.post<ApiKeyRecord>(`api-keys/${id}/regenerate`);
  return res.data;
}

export async function getWebhookEvents() {
  const res = await api.get<string[]>('webhooks/events');
  return res.data;
}

export async function getWebhooks() {
  const res = await api.get<WebhookRecord[]>('webhooks');
  return res.data;
}

export async function createWebhook(data: { event_type: string; endpoint_url: string }) {
  const res = await api.post<WebhookRecord>('webhooks', data);
  return res.data;
}

export async function updateWebhook(id: string, data: {
  event_type?: string;
  endpoint_url?: string;
  status?: string;
}) {
  const res = await api.patch<WebhookRecord>(`webhooks/${id}`, data);
  return res.data;
}

export async function revokeWebhook(id: string) {
  const res = await api.post<WebhookRecord>(`webhooks/${id}/revoke`);
  return res.data;
}

export async function rotateWebhookSecret(id: string) {
  const res = await api.post<WebhookRecord>(`webhooks/${id}/rotate-secret`);
  return res.data;
}

export async function getWebhookDeliveries(webhookId?: string) {
  const res = await api.get<WebhookDelivery[]>('webhooks/deliveries', {
    params: webhookId ? { webhook_id: webhookId } : undefined,
  });
  return res.data;
}

export async function retryWebhookDelivery(id: string) {
  const res = await api.post<WebhookDelivery>(`webhooks/deliveries/${id}/retry`);
  return res.data;
}

export async function retryFailedWebhookDeliveries() {
  const res = await api.post<{ retried: number; deliveries: WebhookDelivery[] }>('webhooks/deliveries/retry-failed');
  return res.data;
}

export async function getCrmConnectorStatus() {
  const res = await api.get<CrmConnectorStatus>('crm-connectors/status');
  return res.data;
}

export async function getHubSpotConnectUrl() {
  const res = await api.get<{ provider: string; url: string }>('crm-connectors/hubspot/connect-url');
  return res.data;
}

export async function importHubSpotContacts() {
  const res = await api.post<{ provider: string; total: number; created: number; updated: number; skipped: number }>(
    'crm-connectors/hubspot/import-contacts',
  );
  return res.data;
}

export async function disconnectHubSpot() {
  const res = await api.post('crm-connectors/hubspot/disconnect');
  return res.data;
}
