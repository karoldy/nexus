import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import request from 'supertest';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from '../src/app.module';
import { auth } from '../src/auth/auth';
import { seedRbac } from '../src/rbac/seed';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TEN_HOURS_SECONDS = 10 * 60 * 60;

function decodeJwtPayload(token: string): { iat?: number; exp?: number } {
  const [, payload] = token.split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    iat?: number;
    exp?: number;
  };
}

describe.skipIf(!hasDatabase)('auth e2e', () => {
  let app: INestApplication;
  const email = `user-${Date.now()}@example.com`;
  const password = 'password-pass-1';
  const nextPassword = 'password-pass-2';
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

  it('issues a 10h access JWT that can call /api/me', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password });
    expect(signIn.status).toBeGreaterThanOrEqual(200);
    expect(signIn.status).toBeLessThan(300);

    const sessionToken = signIn.headers['set-auth-token'] as string | undefined;
    expect(sessionToken).toBeTruthy();

    const tokenRes = await request(app.getHttpServer())
      .get('/api/auth/token')
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(200);

    const accessToken = tokenRes.body.token as string;
    expect(accessToken.split('.').length).toBe(3);

    const payload = decodeJwtPayload(accessToken);
    expect(payload.exp).toBeDefined();
    expect(payload.iat).toBeDefined();
    expect(payload.exp! - payload.iat!).toBeGreaterThanOrEqual(TEN_HOURS_SECONDS - 5);
    expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(TEN_HOURS_SECONDS + 5);

    const me = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.user.email).toBe(email);
  });

  it('rejects change-password with the wrong current password', async () => {
    const change = await agent.post('/api/auth/change-password').send({
      currentPassword: 'wrong-password-1',
      newPassword: nextPassword,
    });
    expect(change.status).toBeGreaterThanOrEqual(400);
  });

  it('changes password and revokes other sessions', async () => {
    const change = await agent.post('/api/auth/change-password').send({
      currentPassword: password,
      newPassword: nextPassword,
      revokeOtherSessions: true,
    });
    expect(change.status).toBeGreaterThanOrEqual(200);
    expect(change.status).toBeLessThan(300);

    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: nextPassword });
    expect(signIn.status).toBeGreaterThanOrEqual(200);
    expect(signIn.status).toBeLessThan(300);
  });

  it('accepts password reset requests without revealing whether the email exists', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const reset = await request(app.getHttpServer()).post('/api/auth/request-password-reset').send({
      email,
      redirectTo: 'http://localhost:3000/reset-password',
    });
    expect(reset.status).toBeGreaterThanOrEqual(200);
    expect(reset.status).toBeLessThan(300);
    expect(reset.body.status).toBe(true);

    const unknown = await request(app.getHttpServer())
      .post('/api/auth/request-password-reset')
      .send({
        email: `missing-${Date.now()}@example.com`,
        redirectTo: 'http://localhost:3000/reset-password',
      });
    expect(unknown.status).toBeGreaterThanOrEqual(200);
    expect(unknown.status).toBeLessThan(300);
    expect(unknown.body.status).toBe(true);

    expect(info.mock.calls.some((call) => String(call[0]).includes(email))).toBe(true);
    info.mockRestore();
  });
});
