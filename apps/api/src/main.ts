import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module';
import { auth } from './auth/auth';
import { seedRbac } from './rbac/seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.setGlobalPrefix('api');

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use('/api/auth', toNodeHandler(auth));
  expressApp.use(json());
  expressApp.use(urlencoded({ extended: true }));

  await seedRbac();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
