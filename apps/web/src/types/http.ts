export type ApiEnvelope<T> = {
  data?: T;
  requestId?: string;
  success?: boolean;
  errorCode?: string;
  errorInfo?: string;
  timestamp?: string;
  code?: number;
  message?: string;
};

export type Paginated<T> = {
  records: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PageQuery = {
  page?: number;
  pageSize?: number;
};
