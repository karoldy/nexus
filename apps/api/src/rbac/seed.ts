import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '../auth/auth';
import { getDb } from '../shared/database/client';
import { user } from '../shared/database/schema/auth';
import { permissions, rolePermissions, roles, userRoles } from '../shared/database/schema/rbac';
import { permissionCodes } from './permissions';

const ROLE_DEFS = [
  { code: 'admin', name: 'Admin' },
  { code: 'user', name: 'User' },
] as const;

const ROOT_EMAIL = 'root@nexus.com';
const ROOT_PASSWORD = 'nexus123';
const ROOT_NAME = 'Root';

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

  await seedRootAdmin(roleRows.admin.id);
}

async function ensureUserRole(userId: string, roleId: string) {
  const db = getDb();
  const existing = await db
    .select()
    .from(userRoles)
    .where(
      and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId), isNull(userRoles.deletedAt)),
    )
    .limit(1);

  if (existing[0]) {
    return;
  }

  await db.insert(userRoles).values({
    id: crypto.randomUUID(),
    userId,
    roleId,
  });
}

async function seedRootAdmin(adminRoleId: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(user)
    .where(and(eq(user.email, ROOT_EMAIL), isNull(user.deletedAt)))
    .limit(1);

  let userId = existing?.id;

  if (!userId) {
    const created = await auth.api.signUpEmail({
      body: {
        name: ROOT_NAME,
        email: ROOT_EMAIL,
        password: ROOT_PASSWORD,
      },
    });
    userId = created.user.id;
  }

  await db
    .update(user)
    .set({
      role: 'admin',
      emailVerified: true,
      banned: false,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));

  await ensureUserRole(userId, adminRoleId);
}
