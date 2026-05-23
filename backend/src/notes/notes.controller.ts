import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

@Controller('notes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  create(@Body() body: any, @GetUser() user: ActiveUser) {
    return this.notesService.create({
      ...body,
      tenantId: user.tenantId,
      userId: user.sub,
    });
  }

  @Get()
  findByEntity(
    @Query('entityId') entityId: string,
    @Query('type') type: 'lead' | 'deal',
    @GetUser() user: ActiveUser,
  ) {
    return this.notesService.findByEntity(entityId, type, user.tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() user: ActiveUser) {
    return this.notesService.remove(id, user.tenantId, user.sub);
  }
}
