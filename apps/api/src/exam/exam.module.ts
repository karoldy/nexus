import { Module } from '@nestjs/common';
import { QuestionModule } from '../question/question.module';
import { RbacModule } from '../rbac/rbac.module';
import { ExamRecordController } from './exam-record.controller';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';

@Module({
  imports: [RbacModule, QuestionModule],
  controllers: [ExamController, ExamRecordController],
  providers: [ExamService],
})
export class ExamModule {}
