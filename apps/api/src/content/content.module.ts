import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [RbacModule],
  controllers: [ContentController],
  providers: [ContentService],
})
export class ContentModule {}
