import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequireAnyPermission, RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get('events')
  @RequireAnyPermission('webhooks.view', 'webhooks.manage')
  listEvents() {
    return this.webhooksService.listEvents();
  }

  @Get()
  @RequirePermission('webhooks.view')
  list(@GetUser() user: ActiveUser) {
    return this.webhooksService.list(user);
  }

  @Post()
  @RequirePermission('webhooks.manage')
  create(@GetUser() user: ActiveUser, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('webhooks.manage')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.update(user, id, dto);
  }

  @Post(':id/revoke')
  @RequirePermission('webhooks.manage')
  revoke(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.webhooksService.revoke(user, id);
  }

  @Post(':id/rotate-secret')
  @RequirePermission('webhooks.manage')
  rotateSecret(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.webhooksService.rotateSecret(user, id);
  }

  @Get('deliveries')
  @RequirePermission('webhooks.view')
  listDeliveries(@GetUser() user: ActiveUser, @Query('webhook_id') webhookId?: string) {
    return this.webhooksService.listDeliveries(user, webhookId);
  }

  @Post('deliveries/:id/retry')
  @RequirePermission('webhooks.manage')
  retryDelivery(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.webhooksService.retryDelivery(user, id);
  }

  @Post('deliveries/retry-failed')
  @RequirePermission('webhooks.manage')
  retryFailed(@GetUser() user: ActiveUser) {
    return this.webhooksService.retryFailed(user);
  }
}
