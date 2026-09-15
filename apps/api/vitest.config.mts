import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://nexus:nexus@localhost:5432/nexus',
      BETTER_AUTH_SECRET: 'test-secret-change-me-please-32ch',
      BETTER_AUTH_URL: 'http://localhost:3000',
    },
  },
});
