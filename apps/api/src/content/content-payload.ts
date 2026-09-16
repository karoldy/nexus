export const CONTENT_TYPES = ['NOTE', 'ARTICLE', 'DOCUMENT', 'RESOURCE'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export type ContentPayloadInput = {
  type: ContentType;
  title: string;
  body?: string | null;
  summary?: string | null;
  url?: string | null;
  fileKey?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type NormalizedContentBody = {
  type: ContentType;
  title: string;
  body: string | null;
  summary: string | null;
  url: string | null;
  fileKey: string | null;
  mimeType: string | null;
  fileSize: number | null;
  metadata: Record<string, unknown> | null;
};

export function isContentType(value: string): value is ContentType {
  return (CONTENT_TYPES as readonly string[]).includes(value);
}

function requireText(value: string | null | undefined, field: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

function optionalText(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function normalizeContentPayload(input: ContentPayloadInput): NormalizedContentBody {
  const title = requireText(input.title, 'title');
  const summary = optionalText(input.summary);
  const metadata = input.metadata ?? null;
  const mimeType = optionalText(input.mimeType);
  let fileSize: number | null = null;
  if (input.fileSize != null) {
    if (!Number.isInteger(input.fileSize) || input.fileSize < 0) {
      throw new Error('fileSize must be a non-negative integer');
    }
    fileSize = input.fileSize;
  }

  if (input.type === 'NOTE' || input.type === 'ARTICLE') {
    return {
      type: input.type,
      title,
      body: requireText(input.body, 'body'),
      summary,
      url: null,
      fileKey: null,
      mimeType: null,
      fileSize: null,
      metadata,
    };
  }

  if (input.type === 'DOCUMENT') {
    return {
      type: input.type,
      title,
      body: null,
      summary,
      url: null,
      fileKey: requireText(input.fileKey, 'fileKey'),
      mimeType,
      fileSize,
      metadata,
    };
  }

  return {
    type: 'RESOURCE',
    title,
    body: null,
    summary,
    url: requireText(input.url, 'url'),
    fileKey: null,
    mimeType: null,
    fileSize: null,
    metadata,
  };
}
