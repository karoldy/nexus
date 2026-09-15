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
