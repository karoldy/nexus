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
import { CreateTagDto, PageQueryDto, UpdateTagDto } from './dto';
import { TagService } from './tag.service';

@Controller('tags')
@UseGuards(PermissionGuard)
export class TagController {
  constructor(private readonly tags: TagService) {}

  @Get()
  @RequirePermissions('knowledge:read')
  list(@CurrentUser() user: { id: string }, @Query() query: PageQueryDto) {
    return this.tags.list(user.id, query);
  }

  @Get(':id')
  @RequirePermissions('knowledge:read')
  get(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.tags.getOwned(user.id, id);
  }

  @Post()
  @RequirePermissions('knowledge:create')
  create(@CurrentUser() user: { id: string }, @Body() body: CreateTagDto) {
    return this.tags.create(user.id, body);
  }

  @Patch(':id')
  @RequirePermissions('knowledge:update')
  update(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTagDto,
  ) {
    return this.tags.update(user.id, id, body);
  }

  @Delete(':id')
  @RequirePermissions('knowledge:delete')
  remove(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.tags.remove(user.id, id);
  }
}
