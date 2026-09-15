import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { admin } from 'better-auth/plugins';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../shared/database/client';
import { account, session, user, verification } from '../shared/database/schema/auth';
import { roles, userRoles } from '../shared/database/schema/rbac';

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-only-change-me-please-32chars',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  basePath: '/api/auth',
  trustedOrigins: ['http://localhost:5173', 'http://localhost:3000'],
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
    defaultCookieAttributes: {
      sameSite: 'lax',
      httpOnly: true,
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      deletedAt: {
        type: 'date',
        required: false,
        input: false,
      },
    },
  },
  plugins: [admin()],
  database: drizzleAdapter(getDb(), {
    provider: 'pg',
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (created) => {
          const db = getDb();
          const [role] = await db
            .select()
            .from(roles)
            .where(and(eq(roles.code, 'user'), isNull(roles.deletedAt)))
            .limit(1);
          if (!role) {
            return;
          }
          await db.insert(userRoles).values({
            id: crypto.randomUUID(),
            userId: created.id,
            roleId: role.id,
          });
        },
      },
    },
    session: {
      create: {
        before: async (sessionRow) => {
          const db = getDb();
          const [found] = await db
            .select()
            .from(user)
            .where(eq(user.id, sessionRow.userId))
            .limit(1);
          if (!found || found.deletedAt) {
            throw new APIError('FORBIDDEN', { message: 'Account is not available' });
          }
          if (
            found.banned &&
            (!found.banExpires || found.banExpires.getTime() > Date.now())
          ) {
            throw new APIError('FORBIDDEN', { message: 'Account is banned' });
          }
          return { data: sessionRow };
        },
      },
    },
  },
});
