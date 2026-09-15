export const QUESTION_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'FILL_BLANK',
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export type QuestionOption = {
  id?: string;
  text: string;
};

export type QuestionKnowledgeRef = {
  id: string;
  title: string;
};

export type Question = {
  id: string;
  ownerId: string;
  type: QuestionType;
  stem: string;
  options: QuestionOption[] | null;
  answer?: Record<string, unknown>;
  explanation: string | null;
  difficulty: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  knowledges: QuestionKnowledgeRef[];
};

export type QuestionPayload = {
  type: QuestionType;
  stem: string;
  options?: QuestionOption[] | null;
  answer: Record<string, unknown>;
  explanation?: string | null;
  difficulty?: number;
  published?: boolean;
  knowledgeIds?: string[];
};

export type QuestionListParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  type?: QuestionType;
  published?: boolean;
  knowledgeId?: string;
  collectionId?: string;
};
