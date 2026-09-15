import type { Collection, CollectionListParams, CollectionPayload, Paginated } from '@/types';
import { deleteData, getData, patchData, postData } from './http';

export function listCollections(params?: CollectionListParams) {
  return getData<Paginated<Collection>>('/collections', params);
}

export function fetchCollection(id: string) {
  return getData<Collection>(`/collections/${id}`);
}

export function createCollection(body: CollectionPayload) {
  return postData<Collection>('/collections', body);
}

export function updateCollection(id: string, body: Partial<CollectionPayload>) {
  return patchData<Collection>(`/collections/${id}`, body);
}

export function deleteCollection(id: string) {
  return deleteData<Collection>(`/collections/${id}`);
}
