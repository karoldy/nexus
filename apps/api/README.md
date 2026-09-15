# api

NestJS + PostgreSQL 后端（Nexus Monorepo 的 `apps/api`）。

- [实体设计](./docs/entities.md)

```bash
pnpm db:up        # Docker Postgres
pnpm db:migrate
pnpm db:seed
pnpm dev          # http://localhost:3000
pnpm test
```

根目录也可：`pnpm --filter @nexus/api db:up`。
