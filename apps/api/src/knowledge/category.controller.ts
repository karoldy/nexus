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
import { CategoryService } from './category.service';
import { CreateCategoryDto, PageQueryDto, UpdateCategoryDto } from './dto';

@Controller('categories')
@UseGuards(PermissionGuard)
export class CategoryController {
  constructor(private readonly categories: CategoryService) {}

  @Get()
  @RequirePermissions('knowledge:read')
  list(@CurrentUser() user: { id: string }, @Query() query: PageQueryDto) {
    return this.categories.list(user.id, query);
  }

  @Get('tree')
  @RequirePermissions('knowledge:read')
  tree(@CurrentUser() user: { id: string }) {
    return this.categories.tree(user.id);
  }

  @Get(':id')
  @RequirePermissions('knowledge:read')
  get(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.categories.getOwned(user.id, id);
  }

  @Post()
  @RequirePermissions('knowledge:create')
  create(@CurrentUser() user: { id: string }, @Body() body: CreateCategoryDto) {
    return this.categories.create(user.id, body);
  }

  @Patch(':id')
  @RequirePermissions('knowledge:update')
  update(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.categories.update(user.id, id, body);
  }

  @Delete(':id')
  @RequirePermissions('knowledge:delete')
  remove(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.categories.remove(user.id, id);
  }
}
