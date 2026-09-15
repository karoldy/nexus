import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../shared/database/client';
import { permissions, rolePermissions, roles } from '../shared/database/schema/rbac';
import { permissionCodes } from './permissions';

const ROLE_DEFS = [
  { code: 'admin', name: 'Admin' },
  { code: 'user', name: 'User' },
] as const;

async function upsertRole(code: string, name: string) {
  const db = getDb();
  const existing = await db
    .select()
    .from(roles)
    .where(and(eq(roles.code, code), isNull(roles.deletedAt)))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const [created] = await db
    .insert(roles)
    .values({
      id: crypto.randomUUID(),
      code,
      name,
      status: true,
    })
    .returning();

  return created;
}

async function upsertPermission(code: string) {
  const db = getDb();
  const existing = await db
    .select()
    .from(permissions)
    .where(and(eq(permissions.code, code), isNull(permissions.deletedAt)))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const [created] = await db
    .insert(permissions)
    .values({
      id: crypto.randomUUID(),
      code,
      name: code,
      status: true,
    })
    .returning();

  return created;
}

async function ensureRolePermission(roleId: string, permissionId: string) {
  const db = getDb();
  const existing = await db
    .select()
    .from(rolePermissions)
    .where(
      and(
        eq(rolePermissions.roleId, roleId),
        eq(rolePermissions.permissionId, permissionId),
        isNull(rolePermissions.deletedAt),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return;
  }

  await db.insert(rolePermissions).values({
    id: crypto.randomUUID(),
    roleId,
    permissionId,
  });
}

export async function seedRbac(): Promise<void> {
  const roleRows = Object.fromEntries(
    await Promise.all(
      ROLE_DEFS.map(async (role) => [role.code, await upsertRole(role.code, role.name)]),
    ),
  ) as Record<(typeof ROLE_DEFS)[number]['code'], Awaited<ReturnType<typeof upsertRole>>>;

  const codes = permissionCodes();
  const permissionRows = await Promise.all(codes.map((code) => upsertPermission(code)));

  for (const permission of permissionRows) {
    await ensureRolePermission(roleRows.admin.id, permission.id);
    if (permission.code.endsWith(':read')) {
      await ensureRolePermission(roleRows.user.id, permission.id);
    }
  }
}

