import type { Paginated, Question, QuestionListParams, QuestionPayload } from '@/types';
import { deleteData, getData, patchData, postData } from './http';

export function listQuestions(params?: QuestionListParams) {
  return getData<Paginated<Question>>('/questions', params);
}

export function fetchQuestion(id: string) {
  return getData<Question>(`/questions/${id}`);
}

export function createQuestion(body: QuestionPayload) {
  return postData<Question>('/questions', body);
}

export function updateQuestion(id: string, body: Partial<QuestionPayload>) {
  return patchData<Question>(`/questions/${id}`, body);
}

export function deleteQuestion(id: string) {
  return deleteData<Question>(`/questions/${id}`);
}
