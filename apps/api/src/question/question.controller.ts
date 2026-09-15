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
import { CreateQuestionDto, QuestionListQueryDto, UpdateQuestionDto } from './dto';
import { QuestionService } from './question.service';

@Controller('questions')
@UseGuards(PermissionGuard)
export class QuestionController {
  constructor(private readonly questions: QuestionService) {}

  @Get()
  @RequirePermissions('question:read')
  list(@CurrentUser() user: { id: string }, @Query() query: QuestionListQueryDto) {
    return this.questions.list(user.id, query);
  }

  @Get(':id')
  @RequirePermissions('question:read')
  get(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.questions.getOwned(user.id, id);
  }

  @Post()
  @RequirePermissions('question:create')
  create(@CurrentUser() user: { id: string }, @Body() body: CreateQuestionDto) {
    return this.questions.create(user.id, body);
  }

  @Patch(':id')
  @RequirePermissions('question:update')
  update(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateQuestionDto,
  ) {
    return this.questions.update(user.id, id, body);
  }

  @Delete(':id')
  @RequirePermissions('question:delete')
  remove(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.questions.remove(user.id, id);
  }
}
