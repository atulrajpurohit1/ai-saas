import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CompanyInsightDto } from './dto/company-insight.dto';
import { DiscoverProspectsDto } from './dto/discover-prospects.dto';
import { ImportProspectDto } from './dto/import-prospect.dto';
import { RenameSavedSearchDto } from './dto/rename-saved-search.dto';
import { SaveSearchDto } from './dto/save-search.dto';
import { SearchProspectsDto } from './dto/search-prospects.dto';
import { ViewProspectDto } from './dto/view-prospect.dto';
import { ProspectSearchHistoryService } from './prospect-search-history.service';
import { ProspectSearchRateLimitGuard } from './prospect-search-rate-limit.guard';
import { ProspectSearchService } from './prospect-search.service';
import { SavedProspectSearchService } from './saved-prospect-search.service';

@Controller('prospect-search')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProspectSearchController {
  constructor(
    private readonly prospectSearchService: ProspectSearchService,
    private readonly historyService: ProspectSearchHistoryService,
    private readonly savedSearchService: SavedProspectSearchService,
  ) {}

  @Post('search')
  @UseGuards(ProspectSearchRateLimitGuard)
  @RequirePermission('prospect_search.view', 'prospect_search.search')
  @HttpCode(HttpStatus.OK)
  search(@Body() dto: SearchProspectsDto, @GetUser() user: ActiveUser) {
    return this.prospectSearchService.search(dto, user);
  }

  @Get('search/:jobId')
  @RequirePermission('prospect_search.view', 'prospect_search.search')
  getSearchJobStatus(
    @Param('jobId') jobId: string,
    @GetUser() user: ActiveUser,
  ) {
    return this.prospectSearchService.getSearchJobStatus(jobId, user);
  }

  /**
   * Real, multi-company/multi-contact discovery search (BlackPearl
   * Prospecting) - the primary "Prospect Search" experience. Distinct from
   * /search above, which only ever researches one already-named company.
   */
  @Post('discover')
  @UseGuards(ProspectSearchRateLimitGuard)
  @RequirePermission('prospect_search.view', 'prospect_search.search')
  @HttpCode(HttpStatus.OK)
  discover(@Body() dto: DiscoverProspectsDto, @GetUser() user: ActiveUser) {
    return this.prospectSearchService.discover(dto, user);
  }

  /**
   * POST rather than GET (unlike /search/:jobId) because polling needs the
   * original search criteria back to build a matching cache key and to
   * label the result - not practical to round-trip an array of filters
   * through a query string.
   */
  @Post('discover/:jobId')
  @RequirePermission('prospect_search.view', 'prospect_search.search')
  @HttpCode(HttpStatus.OK)
  getDiscoveryJobStatus(
    @Param('jobId') jobId: string,
    @Body() dto: DiscoverProspectsDto,
    @GetUser() user: ActiveUser,
  ) {
    return this.prospectSearchService.getDiscoveryJobStatus(jobId, dto, user);
  }

  @Post('view')
  @RequirePermission('prospect_search.view', 'prospect_search.search')
  @HttpCode(HttpStatus.OK)
  recordView(@Body() dto: ViewProspectDto, @GetUser() user: ActiveUser) {
    return this.prospectSearchService.recordView(dto, user);
  }

  @Post('insights')
  @UseGuards(ProspectSearchRateLimitGuard)
  @RequirePermission('prospect_search.view', 'prospect_search.search')
  @HttpCode(HttpStatus.OK)
  getCompanyInsight(
    @Body() dto: CompanyInsightDto,
    @GetUser() user: ActiveUser,
  ) {
    return this.prospectSearchService.getCompanyInsight(dto, user);
  }

  @Post('import')
  @UseGuards(ProspectSearchRateLimitGuard)
  @RequirePermission(
    'prospect_search.view',
    'prospect_search.search',
    'leads.create',
  )
  @HttpCode(HttpStatus.OK)
  importCompany(@Body() dto: ImportProspectDto, @GetUser() user: ActiveUser) {
    return this.prospectSearchService.importCompany(dto, user);
  }

  @Get('history')
  @RequirePermission('prospect_search.view')
  getHistory(@GetUser() user: ActiveUser, @Query('limit') limit?: string) {
    return this.historyService.list(
      user.tenantId,
      user.sub,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('saved-searches')
  @RequirePermission('prospect_search.view')
  getSavedSearches(@GetUser() user: ActiveUser) {
    return this.savedSearchService.list(user.tenantId);
  }

  @Post('saved-searches')
  @RequirePermission('prospect_search.manage')
  @HttpCode(HttpStatus.CREATED)
  createSavedSearch(@Body() dto: SaveSearchDto, @GetUser() user: ActiveUser) {
    return this.savedSearchService.create({
      tenantId: user.tenantId,
      userId: user.sub,
      name: dto.name,
      prompt: dto.prompt,
    });
  }

  @Patch('saved-searches/:id')
  @RequirePermission('prospect_search.manage')
  renameSavedSearch(
    @Param('id') id: string,
    @Body() dto: RenameSavedSearchDto,
    @GetUser() user: ActiveUser,
  ) {
    return this.savedSearchService.rename(
      id,
      user.tenantId,
      user.sub,
      dto.name,
    );
  }

  @Delete('saved-searches/:id')
  @RequirePermission('prospect_search.manage')
  removeSavedSearch(@Param('id') id: string, @GetUser() user: ActiveUser) {
    return this.savedSearchService.remove(id, user.tenantId, user.sub);
  }
}
