import { deleteData, getData, patchData, postData, type Paginated } from './http';
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

export function listKnowledges(params?: KnowledgeListParams) {
  return getData<Paginated<Knowledge>>('/api/knowledges', params);
}

export function fetchKnowledge(id: string) {
  return getData<Knowledge>(`/api/knowledges/${id}`);
}

export function createKnowledge(body: KnowledgePayload) {
  return postData<Knowledge>('/api/knowledges', body);
}

export function updateKnowledge(id: string, body: Partial<KnowledgePayload>) {
  return patchData<Knowledge>(`/api/knowledges/${id}`, body);
}

export function deleteKnowledge(id: string) {
  return deleteData<Knowledge>(`/api/knowledges/${id}`);
}
