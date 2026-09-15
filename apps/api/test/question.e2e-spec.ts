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

describe.skipIf(!hasDatabase)('question e2e', () => {
  let app: INestApplication;
  let adminToken: string;
  let otherToken: string;
  const suffix = Date.now();
  const otherEmail = `qb-other-${suffix}@example.com`;
  const readerEmail = `qb-reader-${suffix}@example.com`;
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

  it('creates TRUE_FALSE and rejects SINGLE_CHOICE with one option', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'TRUE_FALSE',
        stem: `Earth is round ${suffix}`,
        answer: { value: true },
      })
      .expect(201);
    expect(created.body.data.type).toBe('TRUE_FALSE');
    expect(created.body.data.answer).toEqual({ value: true });
    expect(created.body.data.published).toBe(false);
    expect(created.body.data.options).toBeNull();

    const invalid = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'SINGLE_CHOICE',
        stem: `Pick one ${suffix}`,
        options: [{ text: 'Only A' }],
        answer: { optionId: '11111111-1111-4111-8111-111111111111' },
      })
      .expect(400);
    expect(invalid.body.success).toBe(false);
    expect(invalid.body.errorCode).toBe('BAD_REQUEST');
  });

  it('lists drafts by default, excludes them when published=true, and omits answer', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'TRUE_FALSE',
        stem: `Draft listed ${suffix}`,
        answer: { value: false },
        published: false,
      })
      .expect(201);

    const listed = await request(app.getHttpServer())
      .get('/api/questions')
      .query({ q: `Draft listed ${suffix}` })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const row = listed.body.data.records.find(
      (record: { id: string }) => record.id === created.body.data.id,
    );
    expect(row).toBeTruthy();
    expect(row.answer).toBeUndefined();

    const publishedOnly = await request(app.getHttpServer())
      .get('/api/questions')
      .query({ q: `Draft listed ${suffix}`, published: true })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      publishedOnly.body.data.records.some(
        (record: { id: string }) => record.id === created.body.data.id,
      ),
    ).toBe(false);
  });

  it('rejects draft questions that attach knowledge', async () => {
    const knowledge = await request(app.getHttpServer())
      .post('/api/knowledges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Published for draft attach ${suffix}`,
        published: true,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'TRUE_FALSE',
        stem: `Draft with knowledge ${suffix}`,
        answer: { value: true },
        published: false,
        knowledgeIds: [knowledge.body.data.id],
      })
      .expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errorInfo).toMatch(/draft questions cannot attach knowledge/i);
  });

  it('attaches published knowledge to a published question and hides it from other owners', async () => {
    const knowledge = await request(app.getHttpServer())
      .post('/api/knowledges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Published knowledge ${suffix}`,
        published: true,
      })
      .expect(201);

    const unpublished = await request(app.getHttpServer())
      .post('/api/knowledges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Unpublished knowledge ${suffix}`,
        published: false,
      })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'TRUE_FALSE',
        stem: `Published question ${suffix}`,
        answer: { value: true },
        published: true,
        knowledgeIds: [knowledge.body.data.id],
      })
      .expect(201);
    expect(created.body.data.published).toBe(true);
    expect(created.body.data.knowledges).toEqual([
      { id: knowledge.body.data.id, title: knowledge.body.data.title },
    ]);

    const unpublishedAttach = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'TRUE_FALSE',
        stem: `Unpublished knowledge attach ${suffix}`,
        answer: { value: true },
        published: true,
        knowledgeIds: [unpublished.body.data.id],
      })
      .expect(400);
    expect(unpublishedAttach.body.errorInfo).toMatch(/knowledge must be published/i);

    await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'TRUE_FALSE',
        stem: `Missing knowledge attach ${suffix}`,
        answer: { value: true },
        published: true,
        knowledgeIds: ['00000000-0000-4000-8000-000000000000'],
      })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/questions/${created.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('replaces knowledge links when knowledgeIds is sent and keeps them when omitted', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/knowledges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Keep knowledge ${suffix}`,
        published: true,
      })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/knowledges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Clear knowledge ${suffix}`,
        published: true,
      })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'TRUE_FALSE',
        stem: `Replace knowledge ${suffix}`,
        answer: { value: true },
        published: true,
        knowledgeIds: [first.body.data.id, second.body.data.id],
      })
      .expect(201);
    expect(created.body.data.knowledges).toHaveLength(2);

    const cleared = await request(app.getHttpServer())
      .patch(`/api/questions/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ knowledgeIds: [] })
      .expect(200);
    expect(cleared.body.data.knowledges).toEqual([]);

    const restored = await request(app.getHttpServer())
      .patch(`/api/questions/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ knowledgeIds: [first.body.data.id] })
      .expect(200);
    expect(restored.body.data.knowledges).toEqual([
      { id: first.body.data.id, title: first.body.data.title },
    ]);

    const omitted = await request(app.getHttpServer())
      .patch(`/api/questions/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stem: `Replace knowledge kept ${suffix}` })
      .expect(200);
    expect(omitted.body.data.knowledges).toEqual([
      { id: first.body.data.id, title: first.body.data.title },
    ]);
  });

  it('soft-deletes a question so GET returns 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'TRUE_FALSE',
        stem: `Delete me ${suffix}`,
        answer: { value: false },
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/questions/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/questions/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('forbids sign-up users without admin from creating questions', async () => {
    const readerToken = await signIn(app, readerEmail, password);
    const res = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${readerToken}`)
      .send({
        type: 'TRUE_FALSE',
        stem: `Forbidden create ${suffix}`,
        answer: { value: true },
      })
      .expect(403);
    expect(res.body.success).toBe(false);
  });

  it('creates SINGLE_CHOICE, MULTIPLE_CHOICE, SHORT_ANSWER, and FILL_BLANK', async () => {
    const optionA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const optionB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    const single = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'SINGLE_CHOICE',
        stem: `Single ${suffix}`,
        options: [
          { id: optionA, text: 'A' },
          { id: optionB, text: 'B' },
        ],
        answer: { optionId: optionA },
      })
      .expect(201);
    expect(single.body.data.type).toBe('SINGLE_CHOICE');
    expect(single.body.data.answer).toEqual({ optionId: optionA });

    const multi = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'MULTIPLE_CHOICE',
        stem: `Multi ${suffix}`,
        options: [
          { id: optionA, text: 'A' },
          { id: optionB, text: 'B' },
        ],
        answer: { optionIds: [optionA, optionB] },
      })
      .expect(201);
    expect(multi.body.data.type).toBe('MULTIPLE_CHOICE');

    const shortAnswer = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'SHORT_ANSWER',
        stem: `Short ${suffix}`,
        answer: { text: '  hello  ' },
      })
      .expect(201);
    expect(shortAnswer.body.data.type).toBe('SHORT_ANSWER');
    expect(shortAnswer.body.data.answer).toEqual({ text: 'hello' });
    expect(shortAnswer.body.data.options).toBeNull();

    const fill = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'FILL_BLANK',
        stem: `Fill ${suffix}`,
        answer: { blanks: [' one ', 'two'] },
      })
      .expect(201);
    expect(fill.body.data.type).toBe('FILL_BLANK');
    expect(fill.body.data.answer).toEqual({ blanks: ['one', 'two'] });
  });

  it('adds published questions to a draft collection in questionIds order', async () => {
    const first = await createPublishedQuestion(`Member first ${suffix}`);
    const second = await createPublishedQuestion(`Member second ${suffix}`);

    const created = await request(app.getHttpServer())
      .post('/api/collections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Draft collection ${suffix}`,
        published: false,
        questionIds: [second.body.data.id, first.body.data.id],
      })
      .expect(201);

    expect(created.body.data.published).toBe(false);
    expect(created.body.data.questions).toEqual([
      {
        id: second.body.data.id,
        type: 'TRUE_FALSE',
        stem: second.body.data.stem,
        published: true,
        sort: 0,
      },
      {
        id: first.body.data.id,
        type: 'TRUE_FALSE',
        stem: first.body.data.stem,
        published: true,
        sort: 1,
      },
    ]);
    expect(created.body.data.questions[0].answer).toBeUndefined();
  });

  it('rejects draft questions in collection questionIds', async () => {
    const draft = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'TRUE_FALSE',
        stem: `Draft stay out ${suffix}`,
        answer: { value: false },
        published: false,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/collections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Draft member ${suffix}`,
        questionIds: [draft.body.data.id],
      })
      .expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errorInfo).toMatch(/draft questions cannot be added to collections/i);
  });

  it('rejects duplicate collection names with 409', async () => {
    const name = `Unique collection ${suffix}`;
    await request(app.getHttpServer())
      .post('/api/collections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/collections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name })
      .expect(409);
    expect(res.body.success).toBe(false);
    expect(res.body.errorInfo).toMatch(/collection name already exists/i);
  });

  it('hides collections from other owners', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/collections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Private collection ${suffix}` })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/collections/${created.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('lists questions belonging to a collectionId and 404s when the collection is missing', async () => {
    const member = await createPublishedQuestion(`In collection ${suffix}`);
    const outsider = await createPublishedQuestion(`Outside collection ${suffix}`);

    const collection = await request(app.getHttpServer())
      .post('/api/collections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Filter collection ${suffix}`,
        questionIds: [member.body.data.id],
      })
      .expect(201);

    const listed = await request(app.getHttpServer())
      .get('/api/questions')
      .query({ collectionId: collection.body.data.id })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const ids = listed.body.data.records.map((record: { id: string }) => record.id);
    expect(ids).toContain(member.body.data.id);
    expect(ids).not.toContain(outsider.body.data.id);

    await request(app.getHttpServer())
      .get('/api/questions')
      .query({ collectionId: '00000000-0000-4000-8000-000000000000' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('replaces collection members when questionIds is sent and clears them with []', async () => {
    const keep = await createPublishedQuestion(`Keep member ${suffix}`);
    const drop = await createPublishedQuestion(`Drop member ${suffix}`);

    const created = await request(app.getHttpServer())
      .post('/api/collections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Replace members ${suffix}`,
        questionIds: [keep.body.data.id, drop.body.data.id],
      })
      .expect(201);
    expect(created.body.data.questions).toHaveLength(2);

    const cleared = await request(app.getHttpServer())
      .patch(`/api/collections/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionIds: [] })
      .expect(200);
    expect(cleared.body.data.questions).toEqual([]);

    const restored = await request(app.getHttpServer())
      .patch(`/api/collections/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionIds: [keep.body.data.id] })
      .expect(200);
    expect(restored.body.data.questions).toEqual([
      {
        id: keep.body.data.id,
        type: 'TRUE_FALSE',
        stem: keep.body.data.stem,
        published: true,
        sort: 0,
      },
    ]);

    const omitted = await request(app.getHttpServer())
      .patch(`/api/collections/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'kept members' })
      .expect(200);
    expect(omitted.body.data.questions).toHaveLength(1);
    expect(omitted.body.data.questions[0].id).toBe(keep.body.data.id);
  });

  it('rejects duplicate questionIds and hides a collection after soft-delete', async () => {
    const published = await createPublishedQuestion(`Dup member ${suffix}`);

    const duplicate = await request(app.getHttpServer())
      .post('/api/collections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Dup ids ${suffix}`,
        questionIds: [published.body.data.id, published.body.data.id],
      })
      .expect(400);
    expect(duplicate.body.success).toBe(false);

    const created = await request(app.getHttpServer())
      .post('/api/collections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Delete collection ${suffix}` })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/collections/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/collections/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    const listed = await request(app.getHttpServer())
      .get('/api/collections')
      .query({ q: `Delete collection ${suffix}` })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      listed.body.data.records.some((record: { id: string }) => record.id === created.body.data.id),
    ).toBe(false);
  });

  async function createPublishedQuestion(stem: string) {
    return request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'TRUE_FALSE',
        stem,
        answer: { value: true },
        published: true,
      })
      .expect(201);
  }
});
