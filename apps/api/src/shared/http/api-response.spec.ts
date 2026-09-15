import { describe, expect, it } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { errorResponse, paginated, successResponse } from './api-response';
import { extractErrorMessage, httpErrorCode } from './http-exception.filter';

describe('successResponse', () => {
  it('wraps payload with success metadata', () => {
    const body = successResponse({ id: '1' }, 'req-1', 200);
    expect(body).toMatchObject({
      data: { id: '1' },
      requestId: 'req-1',
      success: true,
      code: 200,
      message: 'ok',
    });
    expect(body.timestamp).toEqual(expect.any(String));
  });
});

describe('errorResponse', () => {
  it('wraps failure metadata without data', () => {
    const body = errorResponse('req-2', 401, 'Unauthorized', 'UNAUTHORIZED');
    expect(body).toMatchObject({
      requestId: 'req-2',
      success: false,
      code: 401,
      message: 'Unauthorized',
      errorCode: 'UNAUTHORIZED',
      errorInfo: 'Unauthorized',
    });
    expect(body.data).toBeUndefined();
  });
});

describe('paginated', () => {
  it('computes totalPages', () => {
    expect(paginated(['a'], 11, 1, 10)).toEqual({
      records: ['a'],
      total: 11,
      page: 1,
      pageSize: 10,
      totalPages: 2,
    });
  });
});

describe('httpErrorCode', () => {
  it('maps Nest exception names', () => {
    expect(httpErrorCode(401, new UnauthorizedException().name)).toBe('UNAUTHORIZED');
    expect(httpErrorCode(403, new ForbiddenException().name)).toBe('FORBIDDEN');
  });
});

describe('extractErrorMessage', () => {
  it('joins validation arrays', () => {
    expect(extractErrorMessage({ message: ['a', 'b'] })).toBe('a; b');
  });
});
