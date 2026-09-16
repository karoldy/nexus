import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
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

export const contents = pgTable(
  'contents',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => user.id),
    type: varchar('type', { length: 20 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body'),
    summary: text('summary'),
    url: varchar('url', { length: 2000 }),
    fileKey: varchar('file_key', { length: 500 }),
    mimeType: varchar('mime_type', { length: 100 }),
    fileSize: bigint('file_size', { mode: 'number' }),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    published: boolean('published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('contents_owner_id_idx').on(table.ownerId),
    index('contents_owner_published_idx').on(table.ownerId, table.published),
    index('contents_owner_type_idx').on(table.ownerId, table.type),
  ],
);

export const contentKnowledges = pgTable(
  'content_knowledges',
  {
    id: uuid('id').primaryKey(),
    contentId: uuid('content_id')
      .notNull()
      .references(() => contents.id),
    knowledgeId: uuid('knowledge_id')
      .notNull()
      .references(() => knowledges.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('content_knowledges_active_idx')
      .on(table.contentId, table.knowledgeId)
      .where(sql`${table.deletedAt} is null`),
  ],
);
