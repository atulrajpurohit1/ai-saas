import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { RequirePublicApiPermission } from './public-api.decorator';
import { PublicApiKeyGuard } from './public-api-key.guard';
import { PublicApiLoggingInterceptor } from './public-api-logging.interceptor';
import { PublicApiRequest } from './public-api.types';
import { PublicApiService } from './public-api.service';

@Controller('public')
@UseGuards(PublicApiKeyGuard)
@UseInterceptors(PublicApiLoggingInterceptor)
export class PublicApiController {
  constructor(private readonly publicApiService: PublicApiService) {}

  @Get('clients')
  @RequirePublicApiPermission('clients.read')
  listClients(@Req() request: PublicApiRequest, @Query() query: Record<string, string | undefined>) {
    return this.publicApiService.listClients(request.publicApiKey!, query);
  }

  @Post('clients')
  @RequirePublicApiPermission('clients.write')
  createClient(@Req() request: PublicApiRequest, @Body() body: any) {
    return this.publicApiService.createClient(request.publicApiKey!, body);
  }

  @Get('sites')
  @RequirePublicApiPermission('sites.read')
  listSites(@Req() request: PublicApiRequest, @Query() query: Record<string, string | undefined>) {
    return this.publicApiService.listSites(request.publicApiKey!, query);
  }

  @Post('sites')
  @RequirePublicApiPermission('sites.write')
  createSite(@Req() request: PublicApiRequest, @Body() body: any) {
    return this.publicApiService.createSite(request.publicApiKey!, body);
  }

  @Get('guards')
  @RequirePublicApiPermission('guards.read')
  listGuards(@Req() request: PublicApiRequest, @Query() query: Record<string, string | undefined>) {
    return this.publicApiService.listGuards(request.publicApiKey!, query);
  }

  @Post('guards')
  @RequirePublicApiPermission('guards.write')
  createGuard(@Req() request: PublicApiRequest, @Body() body: any) {
    return this.publicApiService.createGuard(request.publicApiKey!, body);
  }

  @Get('shifts')
  @RequirePublicApiPermission('shifts.read')
  listShifts(@Req() request: PublicApiRequest, @Query() query: Record<string, string | undefined>) {
    return this.publicApiService.listShifts(request.publicApiKey!, query);
  }

  @Post('shifts')
  @RequirePublicApiPermission('shifts.write')
  createShift(@Req() request: PublicApiRequest, @Body() body: any) {
    return this.publicApiService.createShift(request.publicApiKey!, body);
  }

  @Post('shifts/:id/assign')
  @RequirePublicApiPermission('shifts.write')
  assignShift(
    @Req() request: PublicApiRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.publicApiService.assignShift(request.publicApiKey!, id, body);
  }

  @Get('incidents')
  @RequirePublicApiPermission('incidents.read')
  listIncidents(@Req() request: PublicApiRequest, @Query() query: Record<string, string | undefined>) {
    return this.publicApiService.listIncidents(request.publicApiKey!, query);
  }

  @Post('incidents')
  @RequirePublicApiPermission('incidents.write')
  createIncident(@Req() request: PublicApiRequest, @Body() body: any) {
    return this.publicApiService.createIncident(request.publicApiKey!, body);
  }

  @Get('invoices')
  @RequirePublicApiPermission('invoices.read')
  listInvoices(@Req() request: PublicApiRequest, @Query() query: Record<string, string | undefined>) {
    return this.publicApiService.listInvoices(request.publicApiKey!, query);
  }

  @Get('reports')
  @RequirePublicApiPermission('reports.read')
  listReports(@Req() request: PublicApiRequest, @Query() query: Record<string, string | undefined>) {
    return this.publicApiService.listReports(request.publicApiKey!, query);
  }
}
