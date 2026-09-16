import {
  Body,
  Controller,
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
import { ExamRecordListQueryDto, SaveExamAnswersDto } from './dto';
import { ExamService } from './exam.service';

@Controller('exam-records')
@UseGuards(PermissionGuard)
export class ExamRecordController {
  constructor(private readonly exams: ExamService) {}

  @Get()
  @RequirePermissions('exam:read')
  list(@CurrentUser() user: { id: string }, @Query() query: ExamRecordListQueryDto) {
    return this.exams.listRecords(user.id, query);
  }

  @Get(':id')
  @RequirePermissions('exam:read')
  get(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.exams.getRecord(user.id, id);
  }

  @Patch(':id/answers')
  @RequirePermissions('exam:update')
  saveAnswers(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SaveExamAnswersDto,
  ) {
    return this.exams.saveAnswers(user.id, id, body);
  }

  @Post(':id/submit')
  @RequirePermissions('exam:update')
  submit(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.exams.submit(user.id, id);
  }
}
