import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { ProbeController } from './probe.controller';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [MeController, ProbeController],
})
export class AuthModule {}
