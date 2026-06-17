import { Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { RequireAnyPermission } from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { SalesDeliveryService } from './sales-delivery.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('sales-delivery')
export class SalesDeliveryController {
  constructor(private readonly salesDeliveryService: SalesDeliveryService) {}

  @Get('deals/:dealId/follow-up-draft')
  @RequireAnyPermission('ai.view', 'deals.view')
  draftDealFollowUp(@Param('dealId') dealId: string, @GetUser() user: ActiveUser) {
    return this.salesDeliveryService.draftDealFollowUp(user.tenantId, dealId);
  }

  @Post('deals/:dealId/send-follow-up')
  @RequireAnyPermission('activities.manage', 'deals.update', 'proposals.update')
  sendDealFollowUp(@Param('dealId') dealId: string, @GetUser() user: ActiveUser) {
    return this.salesDeliveryService.sendDealFollowUp(user.tenantId, dealId, user.sub);
  }

  @Get('deals/:dealId/calendar.ics')
  @RequireAnyPermission('ai.view', 'deals.view', 'activities.view')
  async calendarForDeal(
    @Param('dealId') dealId: string,
    @GetUser() user: ActiveUser,
    @Res() res: Response,
  ) {
    const calendar = await this.salesDeliveryService.calendarForDeal(user.tenantId, dealId);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${calendar.filename}"`);
    res.status(200).send(calendar.content);
  }
}
