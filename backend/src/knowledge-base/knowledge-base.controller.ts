import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { RequireAnyPermission, RequirePermission } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateKnowledgeEntryDto } from './dto/create-knowledge-entry.dto';
import { UpdateKnowledgeEntryDto } from './dto/update-knowledge-entry.dto';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KNOWLEDGE_CATEGORIES } from './knowledge-base.types';

@Controller('knowledge-base')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Get('categories')
  @RequireAnyPermission('knowledge.view', 'knowledge.manage')
  categories() {
    return KNOWLEDGE_CATEGORIES;
  }

  @Get('search')
  @RequirePermission('knowledge.view')
  search(
    @GetUser() user: ActiveUser,
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('tag') tag?: string,
  ) {
    return this.knowledgeBaseService.search(user.tenantId, user.sub, { q, category, tag });
  }

  @Get()
  @RequirePermission('knowledge.view')
  findAll(
    @GetUser() user: ActiveUser,
    @Query('category') category?: string,
    @Query('tag') tag?: string,
    @Query('include_archived') includeArchived?: string,
  ) {
    return this.knowledgeBaseService.findAll(user.tenantId, user.sub, {
      category,
      tag,
      includeArchived,
    });
  }

  @Post()
  @RequirePermission('knowledge.manage')
  create(@GetUser() user: ActiveUser, @Body() dto: CreateKnowledgeEntryDto) {
    return this.knowledgeBaseService.createManual(user.tenantId, user.sub, dto);
  }

  @Get(':id')
  @RequirePermission('knowledge.view')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.knowledgeBaseService.findOne(user.tenantId, user.sub, id);
  }

  @Patch(':id')
  @RequirePermission('knowledge.manage')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeEntryDto,
  ) {
    return this.knowledgeBaseService.update(user.tenantId, user.sub, id, dto);
  }

  @Post(':id/archive')
  @RequirePermission('knowledge.manage')
  archive(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.knowledgeBaseService.archive(user.tenantId, user.sub, id);
  }
}
