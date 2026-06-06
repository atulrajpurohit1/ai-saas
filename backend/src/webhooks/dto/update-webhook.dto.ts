import { IsIn, IsOptional, IsUrl } from 'class-validator';
import { SUPPORTED_WEBHOOK_EVENTS } from '../webhook-events';

export class UpdateWebhookDto {
  @IsOptional()
  @IsIn(SUPPORTED_WEBHOOK_EVENTS)
  event_type?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  endpoint_url?: string;

  @IsOptional()
  @IsIn(['active', 'revoked'])
  status?: string;
}
