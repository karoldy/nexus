import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';

@Module({
  imports: [RbacModule],
  controllers: [CategoryController, TagController, KnowledgeController],
  providers: [CategoryService, TagService, KnowledgeService],
})
export class KnowledgeModule {}
