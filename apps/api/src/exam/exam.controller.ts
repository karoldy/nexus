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
import { CreateExamDto, ExamListQueryDto, UpdateExamDto } from './dto';
import { ExamService } from './exam.service';

@Controller('exams')
@UseGuards(PermissionGuard)
export class ExamController {
  constructor(private readonly exams: ExamService) {}

  @Get()
  @RequirePermissions('exam:read')
  list(@CurrentUser() user: { id: string }, @Query() query: ExamListQueryDto) {
    return this.exams.list(user.id, query);
  }

  @Get(':id')
  @RequirePermissions('exam:read')
  get(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.exams.getOwned(user.id, id);
  }

  @Post()
  @RequirePermissions('exam:create')
  create(@CurrentUser() user: { id: string }, @Body() body: CreateExamDto) {
    return this.exams.create(user.id, body);
  }

  @Patch(':id')
  @RequirePermissions('exam:update')
  update(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateExamDto,
  ) {
    return this.exams.update(user.id, id, body);
  }

  @Delete(':id')
  @RequirePermissions('exam:delete')
  remove(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.exams.remove(user.id, id);
  }

  @Post(':id/start')
  @RequirePermissions('exam:create')
  start(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.exams.start(user.id, id);
  }
}
