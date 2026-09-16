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

describe.skipIf(!hasDatabase)('content e2e', () => {
  let app: INestApplication;
  let adminToken: string;
  let otherToken: string;
  const suffix = Date.now();
  const otherEmail = `ct-other-${suffix}@example.com`;
  const readerEmail = `ct-reader-${suffix}@example.com`;
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

    await request(app.getHttpServer()).post('/api/auth/sign-up/email').send({
      name: 'Reader',
      email: readerEmail,
      password,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates four types and rejects NOTE without body', async () => {
    const note = await request(app.getHttpServer())
      .post('/api/contents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'NOTE', title: `Note ${suffix}`, body: 'hello' })
      .expect(201);
    expect(note.body.data.type).toBe('NOTE');
    expect(note.body.data.body).toBe('hello');
    expect(note.body.data.url).toBeNull();

    await request(app.getHttpServer())
      .post('/api/contents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'ARTICLE', title: `Article ${suffix}`, body: 'long form' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/contents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'DOCUMENT', title: `Doc ${suffix}`, fileKey: 'uploads/a.pdf' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/contents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'RESOURCE', title: `Res ${suffix}`, url: 'https://example.com' })
      .expect(201);

    const invalid = await request(app.getHttpServer())
      .post('/api/contents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'NOTE', title: `Empty body ${suffix}` })
      .expect(400);
    expect(invalid.body.errorCode).toBe('BAD_REQUEST');
  });

  it('lists drafts by default and omits body from list rows', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/contents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'NOTE', title: `Draft listed ${suffix}`, body: 'secret', published: false })
      .expect(201);

    const listed = await request(app.getHttpServer())
      .get('/api/contents')
      .query({ q: `Draft listed ${suffix}` })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const row = listed.body.data.records.find(
      (record: { id: string }) => record.id === created.body.data.id,
    );
    expect(row).toBeTruthy();
    expect(row.body).toBeUndefined();
    expect(row.fileKey).toBeUndefined();

    const publishedOnly = await request(app.getHttpServer())
      .get('/api/contents')
      .query({ q: `Draft listed ${suffix}`, published: true })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      publishedOnly.body.data.records.some(
        (record: { id: string }) => record.id === created.body.data.id,
      ),
    ).toBe(false);
  });

  it('rejects draft contents that attach knowledge', async () => {
    const knowledge = await request(app.getHttpServer())
      .post('/api/knowledges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `Published for draft content ${suffix}`, published: true })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/contents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'NOTE',
        title: `Draft with knowledge ${suffix}`,
        body: 'x',
        knowledgeIds: [knowledge.body.data.id],
      })
      .expect(400);
    expect(res.body.errorInfo).toMatch(/draft contents cannot attach knowledge/i);
  });

  it('attaches published knowledge and hides content from other owners', async () => {
    const knowledge = await request(app.getHttpServer())
      .post('/api/knowledges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `Published knowledge content ${suffix}`, published: true })
      .expect(201);

    const unpublished = await request(app.getHttpServer())
      .post('/api/knowledges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `Unpublished knowledge content ${suffix}`, published: false })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/api/contents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'NOTE',
        title: `Published content ${suffix}`,
        body: 'x',
        published: true,
        knowledgeIds: [knowledge.body.data.id],
      })
      .expect(201);
    expect(created.body.data.knowledges).toEqual([
      { id: knowledge.body.data.id, title: knowledge.body.data.title },
    ]);

    await request(app.getHttpServer())
      .post('/api/contents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'NOTE',
        title: `Unpublished knowledge attach ${suffix}`,
        body: 'x',
        published: true,
        knowledgeIds: [unpublished.body.data.id],
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/contents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'NOTE',
        title: `Other owner knowledge ${suffix}`,
        body: 'x',
        published: true,
        knowledgeIds: [knowledge.body.data.id],
      })
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/contents/${created.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('soft-deletes a content so GET returns 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/contents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'RESOURCE', title: `To delete ${suffix}`, url: 'https://example.com/x' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/contents/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/contents/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('forbids sign-up users without admin from creating contents', async () => {
    const token = await signIn(app, readerEmail, password);
    await request(app.getHttpServer())
      .post('/api/contents')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'NOTE', title: `Forbidden ${suffix}`, body: 'nope' })
      .expect(403);
  });
});
