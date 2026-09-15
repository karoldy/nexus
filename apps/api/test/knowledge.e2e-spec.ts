import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import request from 'supertest';
import { toNodeHandler } from 'better-auth/node';
import { and, eq, isNull } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { auth } from '../src/auth/auth';
import { seedRbac } from '../src/rbac/seed';
import { getDb } from '../src/shared/database/client';
import { roles, userRoles } from '../src/shared/database/schema/rbac';

const hasDatabase = Boolean(process.env.DATABASE_URL);

async function createApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });
  app.setGlobalPrefix('api');
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use('/api/auth', toNodeHandler(auth));
  expressApp.use(json());
  expressApp.use(urlencoded({ extended: true }));
  await app.init();
  return app;
}

async function signIn(app: INestApplication, email: string, password: string) {
  const signInRes = await request(app.getHttpServer()).post('/api/auth/sign-in/email').send({
    email,
    password,
  });
  expect(signInRes.status).toBeGreaterThanOrEqual(200);
  expect(signInRes.status).toBeLessThan(300);
  const sessionToken = signInRes.headers['set-auth-token'] as string;
  const tokenRes = await request(app.getHttpServer())
    .get('/api/auth/token')
    .set('Authorization', `Bearer ${sessionToken}`)
    .expect(200);
  return tokenRes.body.token as string;
}

async function promoteToAdmin(userId: string) {
  const db = getDb();
  const [adminRole] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.code, 'admin'), isNull(roles.deletedAt)))
    .limit(1);
  expect(adminRole).toBeTruthy();
  await db.insert(userRoles).values({
    id: crypto.randomUUID(),
    userId,
    roleId: adminRole.id,
  });
}

describe.skipIf(!hasDatabase)('knowledge e2e', () => {
  let app: INestApplication;
  let adminToken: string;
  let otherToken: string;
  const suffix = Date.now();
  const otherEmail = `kb-other-${suffix}@example.com`;
  const password = 'password-pass-1';

  beforeAll(async () => {
    await seedRbac();
    app = await createApp();
    adminToken = await signIn(app, 'root@nexus.com', 'nexus123');

    await request(app.getHttpServer()).post('/api/auth/sign-up/email').send({
      name: 'Other Admin',
      email: otherEmail,
      password,
    });
    const otherSession = await signIn(app, otherEmail, password);
    const me = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${otherSession}`)
      .expect(200);
    await promoteToAdmin(me.body.data.user.id as string);
    otherToken = await signIn(app, otherEmail, password);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects invalid create payloads', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'missing-name' })
      .expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errorCode).toBe('BAD_REQUEST');
  });

  it('builds a category tree and blocks delete while children exist', async () => {
    const parent = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Parent ${suffix}`, slug: `parent-${suffix}` })
      .expect(201);

    const child = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Child ${suffix}`,
        slug: `child-${suffix}`,
        parentId: parent.body.data.id,
      })
      .expect(201);

    const cycle = await request(app.getHttpServer())
      .patch(`/api/categories/${parent.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parentId: child.body.data.id })
      .expect(400);
    expect(cycle.body.success).toBe(false);

    const blocked = await request(app.getHttpServer())
      .delete(`/api/categories/${parent.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
    expect(blocked.body.errorInfo).toMatch(/children/i);

    await request(app.getHttpServer())
      .delete(`/api/categories/${child.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/categories/${parent.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const tree = await request(app.getHttpServer())
      .get('/api/categories/tree')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      tree.body.data.find((node: { id: string }) => node.id === parent.body.data.id),
    ).toBeUndefined();
  });

  it('creates knowledge with tags, lists drafts, and hides other owners', async () => {
    const category = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Algo ${suffix}`, slug: `algo-${suffix}` })
      .expect(201);

    const tag = await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `hook-${suffix}` })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/api/knowledges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Draft node ${suffix}`,
        summary: 'summary',
        body: 'body',
        categoryId: category.body.data.id,
        published: false,
        tagIds: [tag.body.data.id],
      })
      .expect(201);

    expect(created.body.data.published).toBe(false);
    expect(created.body.data.tags).toHaveLength(1);
    expect(created.body.data.tags[0].id).toBe(tag.body.data.id);

    const listed = await request(app.getHttpServer())
      .get('/api/knowledges')
      .query({ q: `Draft node ${suffix}` })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      listed.body.data.records.some((row: { id: string }) => row.id === created.body.data.id),
    ).toBe(true);

    const tagged = await request(app.getHttpServer())
      .get('/api/knowledges')
      .query({ tagId: tag.body.data.id })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(tagged.body.data.records).toHaveLength(1);

    const updated = await request(app.getHttpServer())
      .patch(`/api/knowledges/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true, tagIds: [] })
      .expect(200);
    expect(updated.body.data.published).toBe(true);
    expect(updated.body.data.tags).toHaveLength(0);

    await request(app.getHttpServer())
      .get(`/api/knowledges/${created.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/knowledges/${created.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'stolen' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/knowledges/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/knowledges/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
