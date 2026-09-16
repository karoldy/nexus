# Nexus

个人知识体系系统：把收集、学习、成体系、实践和检验收成一条闭环。

> Knowledge 是中心。Content 是载体。Task 是行动。Question / Exam 用来发现薄弱点，再回到学习。

```
收集 → 学习 → 理解 → 建立知识 → 形成体系 → 实践 (Task) → 检验 (Question / Exam) → 发现薄弱 → 重新学习
```

## 仓库结构

本仓库是 pnpm workspace Monorepo：三个应用都在 `apps/` 下，共享包预留在 `packages/`。

| 目录       | 包名         | 端     | 技术栈              |
| ---------- | ------------ | ------ | ------------------- |
| `apps/web` | `@nexus/web` | Web    | Vite + React        |
| `apps/api` | `@nexus/api` | 后端   | NestJS + PostgreSQL |
| `apps/app` | `@nexus/app` | 移动端 | Expo + React Native |

### 开发

需要 Node.js 22+ 与 pnpm 12。

```bash
pnpm install
pnpm --filter @nexus/api db:up      # 当前仅 Postgres；MinIO 见下文 Content
pnpm --filter @nexus/api db:migrate
pnpm --filter @nexus/api db:seed

pnpm dev:api    # NestJS http://localhost:3000
pnpm dev:web    # Vite
pnpm dev:app    # Expo
pnpm build
```

Expo 依赖较大，`pnpm install` 若超时再执行一次即可。

Web 后续再加 shadcn/ui 与 Tailwind CSS。

## 核心领域

```
Personal Knowledge System
├── Auth / RBAC
├── Knowledge
│   ├── Category
│   ├── Tag
│   ├── Knowledge
│   └── Knowledge Relation
├── Content
│   ├── Note
│   ├── Article
│   ├── Document
│   └── Resource
├── Question
│   ├── Question
│   └── Collection
├── Exam
│   ├── Exam
│   ├── Exam Record
│   └── Exam Answer
└── Task
```

---

## 后端 (`apps/api`)

实体字段、关系与约束见 [`apps/api/docs/entities.md`](./apps/api/docs/entities.md)。

按领域分模块，不按数据库表组织。代码在 `apps/api/src/`。

```
apps/api/src/
├── auth/          # authentication + authorization
├── users/
├── rbac/          # 角色 / 权限
├── knowledge/     # knowledge / category / tag / relation
├── content/       # note / article / document / resource
├── question/
├── exam/
├── task/
└── shared/        # 配置、异常、守卫、工具
```

### Auth

解决「你是谁？」。由 **Better Auth** 负责：注册、登录、Session、OAuth、邮箱验证、密码。用户表用库自带的 `user`，软删除用 `deleted_at`，停用用 admin 插件的 `banned`。

### RBAC

解决「你能做什么？」。

```
User ──N:M── UserRole ──► Role ──N:M── RolePermission ──► Permission
```

表：`roles`、`permissions`、`user_roles`、`role_permissions`（自建，挂 Better Auth 的 `user.id`）。

初始角色：`admin`、`user`。

权限示例：`knowledge:read|create|update|delete`，以及 question / exam / task 的同样四件套。

接口上用权限装饰器声明，经 `PermissionGuard` → 认证用户 → Role → Permission → Allow / Deny：

```ts
@RequirePermissions('knowledge:create')
@Post()
create() {}
```

### Knowledge

系统核心。实体：`Knowledge`、`Category`、`Tag`、`KnowledgeRelation`。

**Category** 用树（`parent_id` 自关联），不拆 SubCategory。

```
category: id, parent_id, name, slug, description, sort, created_at, updated_at
```

**Tag** 描述横向特征（如 Hook、性能、设计模式）。Knowledge 与 Tag 多对多，中间表 `knowledge_tag`。

**Knowledge Relation** 描述知识点之间的关系：

```
knowledge_relation: id, source_id, target_id, relation_type, created_at
```

关系类型：`RELATED`、`PREREQUISITE`、`DERIVED`、`EXTENDS`、`CONTRASTS`。

例如：JavaScript → `prerequisite` Promise，`related` Async/Await / Event Loop，`extends` TypeScript。

### Content

知识载体：一张 `contents` 表用 `type` 区分 `NOTE` / `ARTICLE` / `DOCUMENT` / `RESOURCE`。`DOCUMENT` 目前只存 `file_key` 字符串，**不上传、不跑对象存储**。

后续自建文件服务：**在现有 [`apps/api/docker-compose.yml`](apps/api/docker-compose.yml) 里再加一个 MinIO 容器**（与 Postgres 同一次 `pnpm --filter @nexus/api db:up`），不要另开根目录 Compose，也不要把文件写进 Postgres。约定：

- MinIO 走 S3 API（本地约 `9000`），控制台约 `9001`；数据用独立 named volume。
- Nest 鉴权后发 **预签名 PUT/GET**；`file_key` 由服务端生成（如 `{ownerId}/{uuid}.ext`），客户端不要手填任意路径。
- Postgres 继续只记 `file_key` / `mime_type` / `file_size`；软删 Content 不立刻删对象，另做清理任务。

这一步 **尚未落地**（Compose 里暂时只有 Postgres）。

---

## 前端 (`apps/web`)

Web 管理与学习界面。Vite + React + shadcn/ui + Tailwind CSS，调用 `apps/api`。

## App (`apps/app`)

移动端。React Native，与 Web 共用同一套 API 与领域模型。
