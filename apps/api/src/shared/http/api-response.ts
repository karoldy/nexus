export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

export interface ApiResponse<T> {
  data?: T;
  requestId?: string;
  success?: boolean;
  errorCode?: string;
  errorInfo?: string;
  timestamp?: string;
  code?: number;
  message?: string;
}

export interface PaginatedResponse<T> {
  records?: Array<T>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function paginated<T>(
  records: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  return {
    records,
    total,
    page,
    pageSize,
    totalPages: pageSize <= 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export function successResponse<T>(
  data: T,
  requestId: string,
  code = 200,
  message = 'ok',
): ApiResponse<T> {
  return {
    data,
    requestId,
    success: true,
    timestamp: new Date().toISOString(),
    code,
    message,
  };
}

export function errorResponse(
  requestId: string,
  code: number,
  message: string,
  errorCode: string,
  errorInfo = message,
): ApiResponse<never> {
  return {
    requestId,
    success: false,
    timestamp: new Date().toISOString(),
    code,
    message,
    errorCode,
    errorInfo,
  };
}
