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
import { CollectionService } from './collection.service';
import { CollectionListQueryDto, CreateCollectionDto, UpdateCollectionDto } from './dto';

@Controller('collections')
@UseGuards(PermissionGuard)
export class CollectionController {
  constructor(private readonly collections: CollectionService) {}

  @Get()
  @RequirePermissions('question:read')
  list(@CurrentUser() user: { id: string }, @Query() query: CollectionListQueryDto) {
    return this.collections.list(user.id, query);
  }

  @Get(':id')
  @RequirePermissions('question:read')
  get(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.collections.getOwned(user.id, id);
  }

  @Post()
  @RequirePermissions('question:create')
  create(@CurrentUser() user: { id: string }, @Body() body: CreateCollectionDto) {
    return this.collections.create(user.id, body);
  }

  @Patch(':id')
  @RequirePermissions('question:update')
  update(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCollectionDto,
  ) {
    return this.collections.update(user.id, id, body);
  }

  @Delete(':id')
  @RequirePermissions('question:delete')
  remove(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.collections.remove(user.id, id);
  }
}
