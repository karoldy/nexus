import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentPermissions, CurrentUser } from '../rbac/current-user.decorator';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/require-permissions.decorator';

@Controller('me')
@UseGuards(PermissionGuard)
export class MeController {
  @Get()
  @RequirePermissions('knowledge:read')
  me(
    @CurrentUser()
    user: { id: string; email: string; name: string; role: string | null },
    @CurrentPermissions() permissionCodes: string[],
  ) {
    return { user, permissionCodes };
  }
}
