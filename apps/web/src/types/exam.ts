import type { QuestionType } from './question';

export type ExamQuestionRef = {
  id: string;
  type: QuestionType;
  stem: string;
  published: boolean;
  sort: number;
  score: number;
};

export type Exam = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  questions?: ExamQuestionRef[];
};

export type ExamQuestionInput = {
  questionId: string;
  score?: number;
};

export type ExamPayload = {
  title: string;
  description?: string | null;
  durationSeconds?: number | null;
  published?: boolean;
  questions?: ExamQuestionInput[];
};

export type ExamListParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  published?: boolean;
};

export type ExamAnswer = {
  id: string;
  questionId: string;
  type: QuestionType;
  stem: string;
  options: { id: string; text: string }[] | null;
  blankCount: number | null;
  submittedAnswer: Record<string, unknown> | null;
  isCorrect: boolean | null;
  maxScore: number | null;
  score: number | null;
  answer?: Record<string, unknown>;
};

export type ExamRecord = {
  id: string;
  examId: string;
  userId: string;
  progress: 'IN_PROGRESS' | 'SUBMITTED' | 'TIMEOUT';
  status: boolean;
  startedAt: string;
  submittedAt: string | null;
  totalScore: number | null;
  earnedScore: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  examTitle?: string | null;
  durationSeconds?: number | null;
  answers?: ExamAnswer[];
};

export type ExamRecordListParams = {
  page?: number;
  pageSize?: number;
  examId?: string;
};
