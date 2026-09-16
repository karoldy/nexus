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

describe.skipIf(!hasDatabase)('exam e2e', () => {
  let app: INestApplication;
  let adminToken: string;
  let otherToken: string;
  const suffix = Date.now();
  const otherEmail = `ex-other-${suffix}@example.com`;
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

  it('lists drafts, rejects draft questions, and scores a published paper', async () => {
    const draftQuestion = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'TRUE_FALSE',
        stem: `Draft exam q ${suffix}`,
        answer: { value: true },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Draft paper ${suffix}`,
        questions: [{ questionId: draftQuestion.body.data.id }],
      })
      .expect(400);

    const publishedQuestion = await request(app.getHttpServer())
      .post('/api/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'TRUE_FALSE',
        stem: `Published exam q ${suffix}`,
        answer: { value: true },
        published: true,
      })
      .expect(201);

    const exam = await request(app.getHttpServer())
      .post('/api/exams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Paper ${suffix}`,
        published: false,
        questions: [{ questionId: publishedQuestion.body.data.id, score: 2 }],
      })
      .expect(201);
    expect(exam.body.data.published).toBe(false);
    expect(exam.body.data.questions[0].score).toBe(2);

    const listed = await request(app.getHttpServer())
      .get('/api/exams')
      .query({ q: `Paper ${suffix}` })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      listed.body.data.records.some((row: { id: string }) => row.id === exam.body.data.id),
    ).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/exams/${exam.body.data.id}/start`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/exams/${exam.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true })
      .expect(200);

    const started = await request(app.getHttpServer())
      .post(`/api/exams/${exam.body.data.id}/start`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(started.body.data.progress).toBe('IN_PROGRESS');
    expect(started.body.data.answers[0].answer).toBeUndefined();

    const again = await request(app.getHttpServer())
      .post(`/api/exams/${exam.body.data.id}/start`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(again.body.data.id).toBe(started.body.data.id);

    await request(app.getHttpServer())
      .patch(`/api/exam-records/${started.body.data.id}/answers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        answers: [
          {
            questionId: publishedQuestion.body.data.id,
            submittedAnswer: { value: true },
          },
        ],
      })
      .expect(200);

    const submitted = await request(app.getHttpServer())
      .post(`/api/exam-records/${started.body.data.id}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(submitted.body.data.progress).toBe('SUBMITTED');
    expect(submitted.body.data.earnedScore).toBe(2);
    expect(submitted.body.data.totalScore).toBe(2);
    expect(submitted.body.data.answers[0].isCorrect).toBe(true);
    expect(submitted.body.data.answers[0].answer).toEqual({ value: true });

    await request(app.getHttpServer())
      .get(`/api/exams/${exam.body.data.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/exams/${exam.body.data.id}/start`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });
});
