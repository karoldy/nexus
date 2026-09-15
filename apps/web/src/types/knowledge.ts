import type { Category } from './category';
import type { Tag } from './tag';

export type Knowledge = {
  id: string;
  ownerId: string;
  categoryId: string | null;
  title: string;
  summary: string | null;
  body: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  category: Category | null;
  tags: Tag[];
};

export type KnowledgePayload = {
  title: string;
  summary?: string | null;
  body?: string | null;
  categoryId?: string | null;
  published?: boolean;
  tagIds?: string[];
};

export type KnowledgeListParams = {
  page?: number;
  pageSize?: number;
  categoryId?: string;
  tagId?: string;
  published?: boolean;
  q?: string;
};
