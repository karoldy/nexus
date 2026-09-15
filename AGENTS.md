# Nexus 工作约定

根目录只负责 **Monorepo 架构**：workspace 划分、跨包脚本、依赖安装入口。各端自己的运行时、数据库、构建和业务命令放在对应 `apps/*` 里，不要提升到根目录。

## 根目录

- `pnpm-workspace.yaml`、根 `package.json`、`pnpm-lock.yaml`
- 跨端脚本：`pnpm install`、`pnpm build`、`pnpm test`、`pnpm dev:api` / `dev:web` / `dev:app`
- 调某个端的命令用 `pnpm --filter @nexus/<name> <script>`，而不是在根 `package.json` 再包一层平台专用脚本（例如不要在根上放 `db:up`）

## 各端（platform）

| 目录       | 包名         | 自己管什么                                                         |
| ---------- | ------------ | ------------------------------------------------------------------ |
| `apps/api` | `@nexus/api` | Nest、Drizzle、Better Auth、Docker Compose、migrate/seed、API 测试 |
| `apps/web` | `@nexus/web` | Vite / React                                                       |
| `apps/app` | `@nexus/app` | Expo / React Native                                                |

改某端时在该目录下加文件和 `package.json` scripts。共享代码以后放 `packages/`，仍由消费方依赖，不把平台细节写进根脚本。
