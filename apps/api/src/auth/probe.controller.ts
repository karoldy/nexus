import { Controller, Get, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';

@Controller('probe')
@UseGuards(PermissionGuard)
export class ProbeController {
  @Get('create')
  @RequirePermissions('knowledge:create')
  create() {
    return { ok: true };
  }
}
