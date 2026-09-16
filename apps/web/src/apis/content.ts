import type { Content, ContentListParams, ContentPayload, Paginated } from '@/types';
import { deleteData, getData, patchData, postData } from './http';

export function listContents(params?: ContentListParams) {
  return getData<Paginated<Content>>('/contents', params);
}

export function fetchContent(id: string) {
  return getData<Content>(`/contents/${id}`);
}

export function createContent(body: ContentPayload) {
  return postData<Content>('/contents', body);
}

export function updateContent(id: string, body: Partial<ContentPayload>) {
  return patchData<Content>(`/contents/${id}`, body);
}

export function deleteContent(id: string) {
  return deleteData<Content>(`/contents/${id}`);
}
