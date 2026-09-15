export function parsePage(query: { page?: number; pageSize?: number }): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (current && typeof current === 'object') {
    if ('code' in current && (current as { code?: string }).code === '23505') {
      return true;
    }
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}

export function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
  return slug.length > 0 ? slug : 'item';
}
