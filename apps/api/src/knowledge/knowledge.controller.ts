import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../rbac/current-user.decorator';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { CreateKnowledgeDto, KnowledgeListQueryDto, UpdateKnowledgeDto } from './dto';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledges')
@UseGuards(PermissionGuard)
export class KnowledgeController {
  constructor(private readonly knowledges: KnowledgeService) {}

  @Get()
  @RequirePermissions('knowledge:read')
  list(@CurrentUser() user: { id: string }, @Query() query: KnowledgeListQueryDto) {
    return this.knowledges.list(user.id, query);
  }

  @Get(':id')
  @RequirePermissions('knowledge:read')
  get(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.knowledges.getOwned(user.id, id);
  }

  @Post()
  @RequirePermissions('knowledge:create')
  create(@CurrentUser() user: { id: string }, @Body() body: CreateKnowledgeDto) {
    return this.knowledges.create(user.id, body);
  }

  @Patch(':id')
  @RequirePermissions('knowledge:update')
  update(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateKnowledgeDto,
  ) {
    return this.knowledges.update(user.id, id, body);
  }

  @Delete(':id')
  @RequirePermissions('knowledge:delete')
  remove(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.knowledges.remove(user.id, id);
  }
}
