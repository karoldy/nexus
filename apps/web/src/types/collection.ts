import type { QuestionType } from './question';

export type CollectionQuestionRef = {
  id: string;
  type: QuestionType;
  stem: string;
  published: boolean;
  sort: number;
};

export type Collection = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  questions?: CollectionQuestionRef[];
};

export type CollectionPayload = {
  name: string;
  description?: string | null;
  published?: boolean;
  questionIds?: string[];
};

export type CollectionListParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  published?: boolean;
};
