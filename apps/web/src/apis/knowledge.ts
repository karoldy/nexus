import type { Knowledge, KnowledgeListParams, KnowledgePayload, Paginated } from '@/types';
import { deleteData, getData, patchData, postData } from './http';

export function listKnowledges(params?: KnowledgeListParams) {
  return getData<Paginated<Knowledge>>('/knowledges', params);
}

export function fetchKnowledge(id: string) {
  return getData<Knowledge>(`/knowledges/${id}`);
}

export function createKnowledge(body: KnowledgePayload) {
  return postData<Knowledge>('/knowledges', body);
}

export function updateKnowledge(id: string, body: Partial<KnowledgePayload>) {
  return patchData<Knowledge>(`/knowledges/${id}`, body);
}

export function deleteKnowledge(id: string) {
  return deleteData<Knowledge>(`/knowledges/${id}`);
}
