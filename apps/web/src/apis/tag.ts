import type { PageQuery, Paginated, Tag, TagPayload } from '@/types';
import { deleteData, getData, patchData, postData } from './http';

export function listTags(params?: PageQuery) {
  return getData<Paginated<Tag>>('/tags', params);
}

export function createTag(body: TagPayload) {
  return postData<Tag>('/tags', body);
}

export function updateTag(id: string, body: TagPayload) {
  return patchData<Tag>(`/tags/${id}`, body);
}

export function deleteTag(id: string) {
  return deleteData<Tag>(`/tags/${id}`);
}
