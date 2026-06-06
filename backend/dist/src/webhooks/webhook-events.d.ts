export declare const SUPPORTED_WEBHOOK_EVENTS: readonly ["client.created", "guard.created", "shift.created", "shift.assigned", "incident.created", "incident.approved", "invoice.generated", "invoice.paid"];
export type WebhookEventType = (typeof SUPPORTED_WEBHOOK_EVENTS)[number];
