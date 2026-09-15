import type { Request } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

export function ensureRequestId(request: Request): string {
  const existing = request.header(REQUEST_ID_HEADER);
  if (existing) {
    return existing;
  }
  const requestId = crypto.randomUUID();
  request.headers[REQUEST_ID_HEADER] = requestId;
  return requestId;
}
