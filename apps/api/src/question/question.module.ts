import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';
import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';

@Module({
  imports: [RbacModule],
  controllers: [QuestionController, CollectionController],
  providers: [QuestionService, CollectionService],
  exports: [QuestionService],
})
export class QuestionModule {}
