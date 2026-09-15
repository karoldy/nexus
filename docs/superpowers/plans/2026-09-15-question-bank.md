# Question Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship owner-scoped Question API (questions, collections, knowledge links) with the same envelope, soft-delete, and 404 isolation as Knowledge.

**Architecture:** One Nest `QuestionModule` with two controllers. Options/answers live in `jsonb` and are normalized by a pure function before insert. Membership arrays (`knowledgeIds`, `questionIds`) replace junction rows the same way `tagIds` does. No Web UI.

**Tech Stack:** NestJS 11, Drizzle, PostgreSQL, class-validator, Vitest + supertest (`apps/api/test`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-15-question-bank-design.md` — follow it; do not add Exam, Web, `status`, or `collection:*` permissions.
- Soft delete: `deleted_at` only. Lists: `owner_id` + `deleted_at IS NULL` (include drafts).
- Join collection / attach knowledge: both sides same owner, not deleted, `published = true`.
- Cross-owner and missing rows: HTTP 404. Invalid payload / unpublished membership: 400. Duplicate collection name: 409.
- Permissions: `question:read|create|update|delete` for questions and collections.
- Commands: `pnpm --filter @nexus/api …` only. Do not add root scripts.
- Commitlint: `feat(api): …` / `test(api): …` / `docs(api): …` (scope required).
- Reuse `parsePage` and `isUniqueViolation` from `apps/api/src/knowledge/pagination.ts`.
- Global prefix is already `api`. Controllers use `@Controller('questions')` / `@Controller('collections')`.

## File map

- Create: `apps/api/src/shared/database/schema/question.ts` — four tables
- Modify: `apps/api/src/shared/database/schema/index.ts` — re-export
- Create: Drizzle SQL under `apps/api/drizzle/` (generated)
- Modify: `apps/api/docs/entities.md` — Question section without `status`
- Create: `apps/api/src/question/question-payload.ts` — normalize/validate jsonb
- Create: `apps/api/src/question/question-payload.spec.ts` — unit tests
- Create: `apps/api/src/question/dto.ts`
- Create: `apps/api/src/question/question.service.ts` / `question.controller.ts`
- Create: `apps/api/src/question/collection.service.ts` / `collection.controller.ts`
- Create: `apps/api/src/question/question.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/test/question.e2e-spec.ts`

---

### Task 1: Schema, migration, entities.md

**Files:**

- Create: `apps/api/src/shared/database/schema/question.ts`
- Modify: `apps/api/src/shared/database/schema/index.ts`
- Create: `apps/api/drizzle/0004_*.sql` (name from drizzle-kit)
- Modify: `apps/api/docs/entities.md` (section `## 4. Question`)

**Interfaces:**

- Consumes: `user` from `./auth`, `knowledges` from `./knowledge`
- Produces: `questions`, `questionKnowledges`, `collections`, `collectionQuestions` tables

- [ ] **Step 1: Add schema file**

```ts
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { knowledges } from './knowledge';

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => user.id),
    type: varchar('type', { length: 30 }).notNull(),
    stem: text('stem').notNull(),
    options: jsonb('options').$type<{ id: string; text: string }[] | null>(),
    answer: jsonb('answer').notNull().$type<Record<string, unknown>>(),
    explanation: text('explanation'),
    difficulty: integer('difficulty').notNull().default(3),
    published: boolean('published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('questions_owner_id_idx').on(table.ownerId),
    index('questions_owner_published_idx').on(table.ownerId, table.published),
    index('questions_owner_type_idx').on(table.ownerId, table.type),
  ],
);

export const questionKnowledges = pgTable(
  'question_knowledges',
  {
    id: uuid('id').primaryKey(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    knowledgeId: uuid('knowledge_id')
      .notNull()
      .references(() => knowledges.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('question_knowledges_active_idx')
      .on(table.questionId, table.knowledgeId)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const collections = pgTable(
  'collections',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => user.id),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    published: boolean('published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('collections_owner_name_active_idx')
      .on(table.ownerId, table.name)
      .where(sql`${table.deletedAt} is null`),
    index('collections_owner_id_idx').on(table.ownerId),
  ],
);

export const collectionQuestions = pgTable(
  'collection_questions',
  {
    id: uuid('id').primaryKey(),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    sort: integer('sort').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('collection_questions_active_idx')
      .on(table.collectionId, table.questionId)
      .where(sql`${table.deletedAt} is null`),
  ],
);
```

Add `export * from './question';` to `schema/index.ts`.

- [ ] **Step 2: Generate and apply migration**

Run (cwd repo root):

```bash
pnpm --filter @nexus/api db:generate
pnpm --filter @nexus/api db:migrate
```

Expected: new `apps/api/drizzle/0004_*.sql` containing `questions`, `question_knowledges`, `collections`, `collection_questions`. No `status` columns. Unique indexes are partial (`WHERE deleted_at IS NULL`).

- [ ] **Step 3: Update `apps/api/docs/entities.md` Question section**

Replace the Question intro + `questions` / `collections` status rows:

- Delete `status` from both tables.
- Default list: `deleted_at IS NULL` (include drafts).
- Join collection / attach knowledge: same `owner_id`, `deleted_at IS NULL`, `published = true` on **members** (the question and the knowledge). Draft collections may contain published questions.
- Keep jsonb type table as in the spec.
- Junction tables: soft-delete unbind; no `ON DELETE RESTRICT`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/shared/database/schema/question.ts \
  apps/api/src/shared/database/schema/index.ts \
  apps/api/drizzle \
  apps/api/docs/entities.md
git commit -m "$(cat <<'EOF'
feat(api): add question and collection tables

EOF
)"
```

---

### Task 2: Payload normalizer (unit tests first)

**Files:**

- Create: `apps/api/src/question/question-payload.ts`
- Create: `apps/api/src/question/question-payload.spec.ts`

**Interfaces:**

- Consumes: none
- Produces:

```ts
export const QUESTION_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'FILL_BLANK',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type QuestionOptionInput = { id?: string; text: string };
export type NormalizedOption = { id: string; text: string };

export type NormalizedQuestionBody = {
  type: QuestionType;
  stem: string;
  options: NormalizedOption[] | null;
  answer: Record<string, unknown>;
  explanation: string | null;
  difficulty: number;
};

export function isQuestionType(value: string): value is QuestionType;

export function normalizeQuestionPayload(input: {
  type: string;
  stem: string;
  options?: QuestionOptionInput[] | null;
  answer: unknown;
  explanation?: string | null;
  difficulty?: number;
}): NormalizedQuestionBody;
```

Throw `Error` with a human message on invalid input. Service maps that to `BadRequestException`.

- [ ] **Step 1: Write failing unit tests**

`apps/api/src/question/question-payload.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeQuestionPayload } from './question-payload';

describe('normalizeQuestionPayload', () => {
  it('assigns ids for single choice and keeps answer optionId', () => {
    const result = normalizeQuestionPayload({
      type: 'SINGLE_CHOICE',
      stem: 'Pick one',
      options: [{ text: 'A' }, { text: 'B' }],
      answer: { optionId: 'PLACEHOLDER' },
      difficulty: 2,
    });
    expect(result.options).toHaveLength(2);
    expect(result.options?.[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('rejects single choice with one option', () => {
    expect(() =>
      normalizeQuestionPayload({
        type: 'SINGLE_CHOICE',
        stem: 'x',
        options: [{ text: 'A' }],
        answer: { optionId: 'nope' },
      }),
    ).toThrow(/option/i);
  });

  it('accepts true/false without options', () => {
    const result = normalizeQuestionPayload({
      type: 'TRUE_FALSE',
      stem: 'Earth is round',
      answer: { value: true },
    });
    expect(result.options).toBeNull();
    expect(result.answer).toEqual({ value: true });
    expect(result.difficulty).toBe(3);
  });

  it('rejects fill blank with empty string', () => {
    expect(() =>
      normalizeQuestionPayload({
        type: 'FILL_BLANK',
        stem: '2+2=?',
        answer: { blanks: [''] },
      }),
    ).toThrow();
  });
});
```

The first test as written cannot keep `optionId: 'PLACEHOLDER'`. Implement so that if `answer.optionId` is not a generated option id, **rewrite** `optionId` to the first option’s id **only in tests that pass a matching flow**. Better first test:

```ts
it('assigns ids and rewrites optionId when client sends optionIndex 0 via first option text match', () => {
  const result = normalizeQuestionPayload({
    type: 'SINGLE_CHOICE',
    stem: 'Pick one',
    options: [{ id: '11111111-1111-4111-8111-111111111111', text: 'A' }, { text: 'B' }],
    answer: { optionId: '11111111-1111-4111-8111-111111111111' },
  });
  expect(result.options?.[0].id).toBe('11111111-1111-4111-8111-111111111111');
  expect(result.answer).toEqual({ optionId: '11111111-1111-4111-8111-111111111111' });
});
```

Use this version in the spec file (replace the PLACEHOLDER test).

- [ ] **Step 2: Run tests — expect fail**

```bash
pnpm --filter @nexus/api test src/question/question-payload.spec.ts
```

Expected: FAIL, cannot find module `./question-payload`.

- [ ] **Step 3: Implement `question-payload.ts`**

Rules:

- `stem` trim, non-empty.
- `difficulty` default 3, integer 1–5.
- `explanation` trim empty → `null`.
- Choice types: ≥2 options, each `text` trim non-empty; missing `id` → `crypto.randomUUID()`; invalid uuid `id` → throw.
- `SINGLE_CHOICE`: `answer` is `{ optionId }` in the option id set.
- `MULTIPLE_CHOICE`: `optionIds` non-empty array, unique, subset of option ids.
- `TRUE_FALSE` / `SHORT_ANSWER` / `FILL_BLANK`: `options` omitted or null → store `null`; extra options array → throw.
- `SHORT_ANSWER`: `{ text }` trim non-empty.
- `FILL_BLANK`: `{ blanks: string[] }` length ≥ 1, each trim non-empty; store trimmed strings.
- Unknown `type` → throw.

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm --filter @nexus/api test src/question/question-payload.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/question/question-payload.ts apps/api/src/question/question-payload.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): validate question jsonb payloads by type

EOF
)"
```

---

### Task 3: Question REST + attach knowledge

**Files:**

- Create: `apps/api/src/question/dto.ts` (question DTOs in this task; collection DTOs can land in the same file)
- Create: `apps/api/src/question/question.service.ts`
- Create: `apps/api/src/question/question.controller.ts`
- Create: `apps/api/src/question/question.module.ts` (collections stub providers added in Task 4, or add empty collection files that 404 — **add collection controller in Task 4 only**)
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/test/question.e2e-spec.ts` (question cases)

**Interfaces:**

- Consumes: `normalizeQuestionPayload`, `questions`, `questionKnowledges`, `knowledges`, `parsePage`
- Produces: HTTP `/api/questions`

Copy e2e helpers (`createApp`, `signIn`, `promoteToAdmin`) from `apps/api/test/knowledge.e2e-spec.ts`.

DTO highlights:

```ts
export class QuestionOptionDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  text!: string;
}

export class CreateQuestionDto {
  @IsIn(QUESTION_TYPES)
  type!: QuestionType;

  @IsString()
  @IsNotEmpty()
  stem!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[] | null;

  @IsDefined()
  answer!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  explanation?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  knowledgeIds?: string[];
}
```

`UpdateQuestionDto`: all optional; if `type` is present, service requires `options`+`answer` in the same body (after merge with current row, if type changed and options/answer omitted → `BadRequestException`).

List query: extend knowledge-style `published` transform; add `type`, `knowledgeId`, `collectionId`, `q`.

`QuestionService` behavior:

- `list`: omit `answer` from records. Include `knowledges: {id,title}[]` like knowledge tags.
- `getOwned`: full row + knowledges.
- `create`/`update`: `normalizeQuestionPayload`; `published` default false.
- `assertPublishedKnowledges(ownerId, ids)`: each id `get` knowledge with `owner_id`, `deleted_at is null`; if missing → `NotFoundException`; if `published === false` → `BadRequestException('Knowledge must be published')`.
- If `knowledgeIds` length > 0 and resulting `published` is false → `BadRequestException('Draft questions cannot attach knowledge')`.
- `syncKnowledges`: copy `KnowledgeService.syncTags` against `questionKnowledges`.
- `remove`: soft-delete active `question_knowledges` then the question (do **not** touch `collection_questions`; spec: keep membership rows, detail hides deleted questions).

- [ ] **Step 1: Write e2e cases that fail** (file `apps/api/test/question.e2e-spec.ts`)

Minimum `it`s for this task:

1. `TRUE_FALSE` create 201; `SINGLE_CHOICE` with one option 400.
2. Draft listed; `?published=true` excludes it; list record has no `answer`.
3. Draft + `knowledgeIds` 400.
4. Publish knowledge + publish question + attach `knowledgeIds` 201/200; other owner GET 404.
5. PATCH `knowledgeIds: []` clears; omit `knowledgeIds` keeps links.
6. DELETE then GET 404.
7. Sign-up user without admin: POST `/api/questions` 403.

Register `QuestionModule` so routes exist; tests fail until service works.

- [ ] **Step 2: Run e2e — expect fail**

```bash
pnpm --filter @nexus/api test test/question.e2e-spec.ts
```

Expected: FAIL (404 on `/api/questions` or compile error).

- [ ] **Step 3: Implement module, DTO, service, controller, AppModule import**

`QuestionModule` in this task:

```ts
@Module({
  imports: [RbacModule],
  controllers: [QuestionController],
  providers: [QuestionService],
  exports: [QuestionService],
})
export class QuestionModule {}
```

- [ ] **Step 4: Run e2e — expect pass**

```bash
pnpm --filter @nexus/api test test/question.e2e-spec.ts
```

Expected: PASS (collection tests not in this file yet).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/question apps/api/src/app.module.ts apps/api/test/question.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): add owner-scoped question crud

EOF
)"
```

---

### Task 4: Collection REST + remaining spec tests

**Files:**

- Modify: `apps/api/src/question/dto.ts` — collection DTOs
- Create: `apps/api/src/question/collection.service.ts`
- Create: `apps/api/src/question/collection.controller.ts`
- Modify: `apps/api/src/question/question.module.ts` — register collection controller/service
- Modify: `apps/api/test/question.e2e-spec.ts`

**Interfaces:**

- Consumes: `QuestionService.getOwned` (or duplicate get query) to load questions; **do not** use getOwned for unpublished membership — unpublished questions exist; instead `loadPublishedQuestion(ownerId, id)` that 400s if `published === false`, 404 if missing.
- Produces: HTTP `/api/collections`

Collection service:

- Unique name → catch unique violation → `ConflictException('Collection name already exists')`.
- `questionIds` duplicates → 400 before DB.
- `syncQuestions`: like tags, plus set `sort` to array index on insert/restore/update.
- Detail `questions`: join undeleted `collection_questions` to undeleted `questions`, order by `sort`, map `{ id, type, stem, published, sort }` (no answer).
- Soft-delete collection: soft-delete its active `collection_questions` then the collection.
- List filters: `q` on `name` ilike, `published`.

Question list `collectionId`: `exists` undeleted `collection_questions` for that collection id (collection must be owned; if collection missing → 404 **or** empty list). Use 404 if `collectionId` is provided and collection `getOwned` fails.

- [ ] **Step 1: Add failing e2e**

1. Published question into draft collection 201; order of `questionIds` is `sort`.
2. Draft question in `questionIds` → 400.
3. Duplicate collection name → 409.
4. Other owner GET collection → 404.
5. List questions `?collectionId=` returns members.
6. PATCH `questionIds: []` clears members.

- [ ] **Step 2: Run tests — expect fail**

```bash
pnpm --filter @nexus/api test test/question.e2e-spec.ts
```

Expected: FAIL on collection routes.

- [ ] **Step 3: Implement collection service/controller and wire module**

- [ ] **Step 4: Run full API tests**

```bash
pnpm --filter @nexus/api test
```

Expected: PASS (knowledge e2e + question e2e + unit). Requires `DATABASE_URL`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/question apps/api/test/question.e2e-spec.ts
git commit -m "$(cat <<'EOF'
feat(api): add question collections and membership

EOF
)"
```

---

## Self-review

1. **Spec coverage:** tables, five types, no status, draft lists, published-only membership, 404 isolation, 409 names, permissions, entities.md, e2e — all have tasks. Web/Exam excluded.
2. **Placeholders:** none; drizzle file name is generated (`0004_*`).
3. **Types:** `QUESTION_TYPES`, `normalizeQuestionPayload`, `knowledgeIds` / `questionIds` replace semantics match spec.

Plan complete and saved to `docs/superpowers/plans/2026-09-15-question-bank.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks

**2. Inline Execution** — this session, task-by-task with checkpoints

Which approach?
