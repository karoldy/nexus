import type {
  Exam,
  ExamListParams,
  ExamPayload,
  ExamRecord,
  ExamRecordListParams,
  Paginated,
} from '@/types';
import { deleteData, getData, patchData, postData } from './http';

export function listExams(params?: ExamListParams) {
  return getData<Paginated<Exam>>('/exams', params);
}

export function fetchExam(id: string) {
  return getData<Exam>(`/exams/${id}`);
}

export function createExam(body: ExamPayload) {
  return postData<Exam>('/exams', body);
}

export function updateExam(id: string, body: Partial<ExamPayload>) {
  return patchData<Exam>(`/exams/${id}`, body);
}

export function deleteExam(id: string) {
  return deleteData<Exam>(`/exams/${id}`);
}

export function startExam(id: string) {
  return postData<ExamRecord>(`/exams/${id}/start`, {});
}

export function listExamRecords(params?: ExamRecordListParams) {
  return getData<Paginated<ExamRecord>>('/exam-records', params);
}

export function fetchExamRecord(id: string) {
  return getData<ExamRecord>(`/exam-records/${id}`);
}

export function saveExamAnswers(
  id: string,
  answers: { questionId: string; submittedAnswer: Record<string, unknown> | null }[],
) {
  return patchData<ExamRecord>(`/exam-records/${id}/answers`, { answers });
}

export function submitExamRecord(id: string) {
  return postData<ExamRecord>(`/exam-records/${id}/submit`, {});
}
