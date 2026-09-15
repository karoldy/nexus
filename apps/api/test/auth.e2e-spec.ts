import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import request from 'supertest';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from '../src/app.module';
import { auth } from '../src/auth/auth';
import { seedRbac } from '../src/rbac/seed';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)('auth e2e', () => {
  let app: INestApplication;
  const email = `user-${Date.now()}@example.com`;
  const password = 'password-pass-1';
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    await seedRbac();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.setGlobalPrefix('api');
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use('/api/auth', toNodeHandler(auth));
    expressApp.use(json());
    expressApp.use(urlencoded({ extended: true }));
    await app.init();
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated /api/me', async () => {
    await request(app.getHttpServer()).get('/api/me').expect(401);
  });

  it('registers, signs in, and reads /api/me', async () => {
    const signUp = await agent.post('/api/auth/sign-up/email').send({
      name: 'Test User',
      email,
      password,
    });
    expect(signUp.status).toBeGreaterThanOrEqual(200);
    expect(signUp.status).toBeLessThan(300);

    const me = await agent.get('/api/me').expect(200);
    expect(me.body.user.email).toBe(email);
    expect(me.body.permissionCodes).toContain('knowledge:read');
    expect(me.body.permissionCodes).not.toContain('knowledge:create');
  });

  it('forbids knowledge:create for the default user role', async () => {
    await agent.get('/api/probe/create').expect(403);
  });
});
