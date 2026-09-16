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
import { ContentService } from './content.service';
import { ContentListQueryDto, CreateContentDto, UpdateContentDto } from './dto';

@Controller('contents')
@UseGuards(PermissionGuard)
export class ContentController {
  constructor(private readonly contents: ContentService) {}

  @Get()
  @RequirePermissions('content:read')
  list(@CurrentUser() user: { id: string }, @Query() query: ContentListQueryDto) {
    return this.contents.list(user.id, query);
  }

  @Get(':id')
  @RequirePermissions('content:read')
  get(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.contents.getOwned(user.id, id);
  }

  @Post()
  @RequirePermissions('content:create')
  create(@CurrentUser() user: { id: string }, @Body() body: CreateContentDto) {
    return this.contents.create(user.id, body);
  }

  @Patch(':id')
  @RequirePermissions('content:update')
  update(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateContentDto,
  ) {
    return this.contents.update(user.id, id, body);
  }

  @Delete(':id')
  @RequirePermissions('content:delete')
  remove(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.contents.remove(user.id, id);
  }
}
