import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { questions } from './question';

export const exams = pgTable(
  'exams',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => user.id),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    durationSeconds: integer('duration_seconds'),
    published: boolean('published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('exams_owner_title_active_idx')
      .on(table.ownerId, table.title)
      .where(sql`${table.deletedAt} is null`),
    index('exams_owner_id_idx').on(table.ownerId),
    index('exams_owner_published_idx').on(table.ownerId, table.published),
  ],
);

export const examQuestions = pgTable(
  'exam_questions',
  {
    id: uuid('id').primaryKey(),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    sort: integer('sort').notNull().default(0),
    score: numeric('score', { precision: 8, scale: 2 }).notNull().default('1'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('exam_questions_active_idx')
      .on(table.examId, table.questionId)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const examRecords = pgTable(
  'exam_records',
  {
    id: uuid('id').primaryKey(),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    progress: varchar('progress', { length: 20 }).notNull(),
    status: boolean('status').notNull().default(true),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    totalScore: numeric('total_score', { precision: 8, scale: 2 }),
    earnedScore: numeric('earned_score', { precision: 8, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('exam_records_in_progress_idx')
      .on(table.examId, table.userId)
      .where(sql`${table.deletedAt} is null and ${table.progress} = 'IN_PROGRESS'`),
    index('exam_records_exam_user_idx').on(table.examId, table.userId),
  ],
);

export const examAnswers = pgTable(
  'exam_answers',
  {
    id: uuid('id').primaryKey(),
    recordId: uuid('record_id')
      .notNull()
      .references(() => examRecords.id),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    typeSnapshot: varchar('type_snapshot', { length: 30 }).notNull(),
    stemSnapshot: text('stem_snapshot').notNull(),
    optionsSnapshot: jsonb('options_snapshot').$type<{ id: string; text: string }[] | null>(),
    answerSnapshot: jsonb('answer_snapshot').notNull().$type<Record<string, unknown>>(),
    submittedAnswer: jsonb('submitted_answer').$type<Record<string, unknown> | null>(),
    isCorrect: boolean('is_correct'),
    maxScore: numeric('max_score', { precision: 8, scale: 2 }).notNull(),
    score: numeric('score', { precision: 8, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('exam_answers_active_idx')
      .on(table.recordId, table.questionId)
      .where(sql`${table.deletedAt} is null`),
  ],
);
