# 题库 / 题目模块设计

日期：2026-09-15  
范围：`apps/api` 的 Question 域第一期（API + Vitest）。不做 Web、App、Exam、Content。

## 目标

个人题库：owner 隔离下管理题目与题集，题目可挂已发布知识点。形态对齐已落地的 Knowledge 模块（软删、`published`、分页信封、越权 404）。

## 已拍板

- 一次做完 Question 四张表：题目、题集、挂知识、题集收录。
- 不要 `status`。只用 `deleted_at` + `published`。列表默认含草稿。
- 五种题型：`SINGLE_CHOICE` / `MULTIPLE_CHOICE` / `TRUE_FALSE` / `SHORT_ANSWER` / `FILL_BLANK`。
- 选项与答案存 PostgreSQL `jsonb`，按 `type` 校验。
- 进题集、挂知识点：两端必须同一 `owner_id`、未删、且 **已发布**。
- 权限码沿用 `question:read|create|update|delete`；题集共用这组，不新增 `collection:*`。
- 默认 `user` 角色仍只有各资源 `read`。

## 非目标

考试组卷、作答快照、判分、导入导出、附件/对象存储、跨用户、公开浏览、Web 工作台。

---

## 数据模型

Schema 文件：`apps/api/src/shared/database/schema/question.ts`，从 `schema/index.ts` 导出。主键 UUID，应用侧 `crypto.randomUUID()`。时间 `timestamptz`。

### questions

| 字段                    | 类型        | 约束                    | 说明               |
| ----------------------- | ----------- | ----------------------- | ------------------ |
| id                      | uuid        | PK                      |                    |
| owner_id                | uuid        | FK `user.id`，not null  |                    |
| type                    | varchar(30) | not null                | 题型，不是启用状态 |
| stem                    | text        | not null                | 题干               |
| options                 | jsonb       | nullable                | 见题型表           |
| answer                  | jsonb       | not null                | 见题型表           |
| explanation             | text        | nullable                | 解析               |
| difficulty              | int         | not null，default 3     | 1–5                |
| published               | boolean     | not null，default false | 草稿 / 已发布      |
| created_at / updated_at | timestamptz | not null                |                    |
| deleted_at              | timestamptz | nullable                | 软删               |

索引：`owner_id`；`(owner_id, published)`；`(owner_id, type)`。

### question_knowledges

| 字段                    | 类型        | 约束                    |
| ----------------------- | ----------- | ----------------------- |
| id                      | uuid        | PK                      |
| question_id             | uuid        | FK questions，not null  |
| knowledge_id            | uuid        | FK knowledges，not null |
| created_at / updated_at | timestamptz | not null                |
| deleted_at              | timestamptz | nullable                |

部分唯一：`(question_id, knowledge_id) WHERE deleted_at IS NULL`。

### collections

| 字段                    | 类型         | 约束                    | 说明 |
| ----------------------- | ------------ | ----------------------- | ---- |
| id                      | uuid         | PK                      |      |
| owner_id                | uuid         | FK `user.id`，not null  |      |
| name                    | varchar(200) | not null                |      |
| description             | text         | nullable                |      |
| published               | boolean      | not null，default false |      |
| created_at / updated_at | timestamptz  | not null                |      |
| deleted_at              | timestamptz  | nullable                |      |

部分唯一：`(owner_id, name) WHERE deleted_at IS NULL`。同名冲突返回 409。

### collection_questions

| 字段                    | 类型        | 约束                     |
| ----------------------- | ----------- | ------------------------ |
| id                      | uuid        | PK                       |
| collection_id           | uuid        | FK collections，not null |
| question_id             | uuid        | FK questions，not null   |
| sort                    | int         | not null，default 0      |
| created_at / updated_at | timestamptz | not null                 |
| deleted_at              | timestamptz | nullable                 |

部分唯一：`(collection_id, question_id) WHERE deleted_at IS NULL`。

### 题型与 jsonb

| type            | options                                                  | answer                                                |
| --------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| SINGLE_CHOICE   | `[{ "id": uuid, "text": string }]`，至少 2 项，text 非空 | `{ "optionId": uuid }` 必须是某选项 id                |
| MULTIPLE_CHOICE | 同上至少 2 项                                            | `{ "optionIds": uuid[] }` 非空、去重、都在 options 内 |
| TRUE_FALSE      | `null`                                                   | `{ "value": boolean }`                                |
| SHORT_ANSWER    | `null`                                                   | `{ "text": string }` trim 后非空                      |
| FILL_BLANK      | `null`                                                   | `{ "blanks": string[] }` 至少 1 个，每项 trim 后非空  |

写入规则：

- 客户端创建选项可只传 `{ "text" }`；服务端生成 UUID。PATCH 时带上已有 `id` 则保留，未带 `id` 的视为新选项。
- 非选择题写入时 `options` 必须为 `null`（或省略，服务端写成 `null`）。
- 更改 `type` 的同一次请求必须带上该题型合法的 `options` 与 `answer`，否则 400。
- `difficulty` 超出 1–5：400。

### 查询与成员资格

- 题目/题集列表：`owner_id = 当前用户 AND deleted_at IS NULL`，**含草稿**。可用 `published`、`type`、`knowledgeId`、`collectionId`、`q`（题干 `ilike`；题集对 `name` `ilike`）过滤。
- 挂知识：题目必须已发布；每个 `knowledgeId` 必须属于同一 owner、未删、已发布。空数组表示清空挂接。草稿题若带非空 `knowledgeIds`：400。
- 入集：每个 `questionId` 必须属于同一 owner、未删、已发布。草稿题集可以收录已发布题。空数组表示清空收录。
- 题目事后改为草稿：已有挂接与入集行保留，列表仍能在题集详情里看到该题；但不能再把它新加进任何题集，也不能再给草稿题新增知识点。
- 软删题目或题集：不硬删中间表。题目软删时，将其未删的 `question_knowledges` 一并软删（对齐知识库删知识时软删 `knowledge_tags`）。题集软删时，将其未删的 `collection_questions` 一并软删。
- 越权、跨 owner、已软删：一律 **404**，与 Knowledge 相同。不跨用户。

---

## API

模块：`apps/api/src/question/`，在 `AppModule` 注册。全局 `ValidationPipe` 已开启（whitelist / forbidNonWhitelisted / transform）。HTTP 信封不变。

权限：`PermissionGuard` + `@RequirePermissions('question:…')`。

| 方法   | 路径                   | 权限   | 行为                                                         |
| ------ | ---------------------- | ------ | ------------------------------------------------------------ |
| GET    | `/api/questions`       | read   | 分页，默认 `page=1` `pageSize=20`，`orderBy updated_at desc` |
| GET    | `/api/questions/:id`   | read   | 含 `knowledges`、`options`、`answer`、`explanation`          |
| POST   | `/api/questions`       | create | 创建                                                         |
| PATCH  | `/api/questions/:id`   | update | 部分更新；`knowledgeIds` 出现则整表替换                      |
| DELETE | `/api/questions/:id`   | delete | 软删                                                         |
| GET    | `/api/collections`     | read   | 分页                                                         |
| GET    | `/api/collections/:id` | read   | 含 `questions`（按 `sort`）                                  |
| POST   | `/api/collections`     | create | 创建；`questionIds` 可选，下标即 `sort`                      |
| PATCH  | `/api/collections/:id` | update | `questionIds` 出现则整表替换                                 |
| DELETE | `/api/collections/:id` | delete | 软删                                                         |

不提供入集/出集子资源。

### 题目写入体

```
{
  type: QuestionType
  stem: string
  options?: { id?: string; text: string }[] | null
  answer: object
  explanation?: string | null
  difficulty?: number
  published?: boolean
  knowledgeIds?: string[]
}
```

PATCH 字段均可选。若 PATCH 了 `type`，必须同时给合法 `options` 与 `answer`。

### 题集写入体

```
{
  name: string
  description?: string | null
  published?: boolean
  questionIds?: string[]
}
```

`questionIds` 重复：400。`name` 空：400。

### 列表查询

题目：`page`、`pageSize`、`q`、`type`、`published`、`knowledgeId`、`collectionId`。  
`collectionId` 只匹配该题集中 `collection_questions.deleted_at IS NULL` 的题。

题集：`page`、`pageSize`、`q`、`published`。

### 响应形状

列表/详情走现有 `{ data, … }`；分页为 `paginated` 的 `records/total/page/pageSize/totalPages`。

- 题目列表项：id、type、stem、difficulty、published、updatedAt；**不含 answer**。可含知识点标题摘要（与知识列表带 tags 同级信息量即可）。
- 题目详情：上列全部 + options、answer、explanation、`knowledges: { id, title }[]`（仅未删挂接；知识点已软删的挂接行不出现）。
- 题集列表项：id、name、description、published、updatedAt。
- 题集详情：上列 + `questions: { id, type, stem, published, sort }[]`。**不含答案。** 已软删题目不出现在该数组。

### 错误

| 情况                                                                                                  | HTTP                    |
| ----------------------------------------------------------------------------------------------------- | ----------------------- |
| 未登录 / 无权限码                                                                                     | 与现网一致（401 / 403） |
| 资源不存在、已软删、非 owner                                                                          | 404                     |
| 题型与 jsonb 不合法、难度越界、草稿挂知识、入集非已发布题、知识点未发布或跨 owner、`questionIds` 重复 | 400                     |
| 同 owner 未删题集重名                                                                                 | 409                     |

---

## 文件与文档

新建：

- `apps/api/src/shared/database/schema/question.ts`
- Drizzle 迁移（`pnpm --filter @nexus/api db:generate` 后提交 SQL）
- `apps/api/src/question/question.module.ts`
- `apps/api/src/question/dto.ts`
- `apps/api/src/question/question.controller.ts` / `question.service.ts`
- `apps/api/src/question/collection.controller.ts` / `collection.service.ts`
- `apps/api/test/question.e2e-spec.ts`（对齐 `apps/api/test/knowledge.e2e-spec.ts`）

修改：

- `apps/api/src/shared/database/schema/index.ts` 导出 question
- `apps/api/src/app.module.ts` 导入 `QuestionModule`
- `apps/api/docs/entities.md` Question 节：删除 `status`；默认列表改为含草稿；入集/挂知识规则改为「未删 + published」；中间表软删，无 `ON DELETE RESTRICT`

不改根目录 `package.json`。命令仍用 `pnpm --filter @nexus/api …`。

权限 seed：`RESOURCES` 已含 `question`，不必改权限码列表。

---

## 测试

在 `apps/api/test/question.e2e-spec.ts` 用管理员账号（与知识库 e2e 相同）覆盖：

1. 五种题型创建成功；错误 options/answer 返回 400。
2. 列表含草稿；`published=true` 过滤只出已发布。
3. 草稿题 `knowledgeIds` 非空 → 400；已发布题挂已发布知识成功；挂别人的/草稿/已删知识 → 400 或 404（不存在的知识按 getOwned 404，未发布按 400）。
4. `knowledgeIds` 整表替换：省略字段不改挂接；传 `[]` 清空。
5. 草稿题不能入集；已发布题可加入草稿题集；`questionIds` 下标即 sort。
6. 题集重名 409。
7. 另一用户 id 访问 → 404。
8. 软删后 GET 列表不可见；详情 404。
9. 无 `question:create` 的用户创建 → 403。

---

## 实现顺序

1. Schema + 迁移 + 更新 `entities.md`
2. DTO 与题型校验纯函数（可单测）
3. Question CRUD + 挂知识
4. Collection CRUD + 入集
5. e2e
6. 注册模块

Web 工作台明确列为后续独立设计，不在本 spec 实施范围内。
