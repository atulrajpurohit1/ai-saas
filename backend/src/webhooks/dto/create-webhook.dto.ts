import { IsIn, IsUrl } from 'class-validator';
import { SUPPORTED_WEBHOOK_EVENTS } from '../webhook-events';

export class CreateWebhookDto {
  @IsIn(SUPPORTED_WEBHOOK_EVENTS)
  event_type: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  endpoint_url: string;
}
