import { deleteData, getData, patchData, postData, type Paginated } from './http';

export type Tag = {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export function listTags(params?: { page?: number; pageSize?: number }) {
  return getData<Paginated<Tag>>('/api/tags', params);
}

export function createTag(body: { name: string }) {
  return postData<Tag>('/api/tags', body);
}

export function updateTag(id: string, body: { name: string }) {
  return patchData<Tag>(`/api/tags/${id}`, body);
}

export function deleteTag(id: string) {
  return deleteData<Tag>(`/api/tags/${id}`);
}
