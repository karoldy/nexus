import {
  boolean,
  index,
  integer,
  type AnyPgColumn,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth';

const ROOT_PARENT = sql`'00000000-0000-0000-0000-000000000000'::uuid`;

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => user.id),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    description: text('description'),
    sort: integer('sort').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('categories_owner_parent_slug_active_idx')
      .on(table.ownerId, sql`coalesce(${table.parentId}, ${ROOT_PARENT})`, table.slug)
      .where(sql`${table.deletedAt} is null`),
    index('categories_owner_id_idx').on(table.ownerId),
  ],
);

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => user.id),
    name: varchar('name', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('tags_owner_name_active_idx')
      .on(table.ownerId, table.name)
      .where(sql`${table.deletedAt} is null`),
    index('tags_owner_id_idx').on(table.ownerId),
  ],
);

export const knowledges = pgTable(
  'knowledges',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => user.id),
    categoryId: uuid('category_id').references(() => categories.id),
    title: varchar('title', { length: 200 }).notNull(),
    summary: text('summary'),
    body: text('body'),
    published: boolean('published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('knowledges_owner_category_idx').on(table.ownerId, table.categoryId),
    index('knowledges_owner_published_idx').on(table.ownerId, table.published),
  ],
);

export const knowledgeTags = pgTable(
  'knowledge_tags',
  {
    id: uuid('id').primaryKey(),
    knowledgeId: uuid('knowledge_id')
      .notNull()
      .references(() => knowledges.id),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('knowledge_tags_active_idx')
      .on(table.knowledgeId, table.tagId)
      .where(sql`${table.deletedAt} is null`),
  ],
);
