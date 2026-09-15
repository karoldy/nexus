import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../shared/database/client';
import { permissions, rolePermissions, roles, userRoles } from '../shared/database/schema/rbac';

export const RESOURCES = ['knowledge', 'content', 'question', 'exam', 'task'] as const;

export const ACTIONS = ['read', 'create', 'update', 'delete'] as const;

export const ADMIN_ROLE = 'admin';

export function permissionCodes(): string[] {
  return RESOURCES.flatMap((resource) => ACTIONS.map((action) => `${resource}:${action}`));
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === ADMIN_ROLE;
}

export function hasAllPermissions(granted: string[], required: string[]): boolean {
  const set = new Set(granted);
  return required.every((code) => set.has(code));
}

export async function listPermissionCodesForUser(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ code: permissions.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        eq(userRoles.userId, userId),
        isNull(userRoles.deletedAt),
        isNull(roles.deletedAt),
        eq(roles.status, true),
        isNull(rolePermissions.deletedAt),
        isNull(permissions.deletedAt),
        eq(permissions.status, true),
      ),
    );

  return [...new Set(rows.map((row) => row.code))];
}
