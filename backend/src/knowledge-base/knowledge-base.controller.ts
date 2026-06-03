import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateKnowledgeEntryDto } from './dto/create-knowledge-entry.dto';
import { UpdateKnowledgeEntryDto } from './dto/update-knowledge-entry.dto';
import { KnowledgeBaseService } from './knowledge-base.service';

@Controller('knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Get()
  findAll(
    @GetUser() user: ActiveUser,
    @Query('category') category?: string,
    @Query('tag') tag?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.knowledgeBaseService.findAll(user.tenantId, user.sub, {
      category,
      tag,
      includeArchived,
    });
  }

  @Get('search')
  search(
    @GetUser() user: ActiveUser,
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('tag') tag?: string,
  ) {
    return this.knowledgeBaseService.search(user.tenantId, user.sub, { q, category, tag });
  }

  @Get(':id')
  findOne(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.knowledgeBaseService.findOne(user.tenantId, user.sub, id);
  }

  @Post()
  create(@GetUser() user: ActiveUser, @Body() dto: CreateKnowledgeEntryDto) {
    return this.knowledgeBaseService.createManual(user.tenantId, user.sub, dto);
  }

  @Patch(':id')
  update(
    @GetUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeEntryDto,
  ) {
    return this.knowledgeBaseService.update(user.tenantId, user.sub, id, dto);
  }

  @Post(':id/archive')
  archive(@GetUser() user: ActiveUser, @Param('id') id: string) {
    return this.knowledgeBaseService.archive(user.tenantId, user.sub, id);
  }
}
