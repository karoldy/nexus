export const CONTENT_TYPES = ['NOTE', 'ARTICLE', 'DOCUMENT', 'RESOURCE'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export type ContentKnowledgeRef = {
  id: string;
  title: string;
};

export type Content = {
  id: string;
  ownerId: string;
  type: ContentType;
  title: string;
  body?: string | null;
  summary: string | null;
  url?: string | null;
  fileKey?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  metadata?: Record<string, unknown> | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  knowledges: ContentKnowledgeRef[];
};

export type ContentPayload = {
  type: ContentType;
  title: string;
  body?: string | null;
  summary?: string | null;
  url?: string | null;
  fileKey?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  metadata?: Record<string, unknown> | null;
  published?: boolean;
  knowledgeIds?: string[];
};

export type ContentListParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  type?: ContentType;
  published?: boolean;
  knowledgeId?: string;
};
