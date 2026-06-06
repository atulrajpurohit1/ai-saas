export const SUPPORTED_WEBHOOK_EVENTS = [
  'client.created',
  'guard.created',
  'shift.created',
  'shift.assigned',
  'incident.created',
  'incident.approved',
  'invoice.generated',
  'invoice.paid',
] as const;

export type WebhookEventType = (typeof SUPPORTED_WEBHOOK_EVENTS)[number];
