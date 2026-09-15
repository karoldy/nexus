import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import type { ApiEnvelope } from '@/types';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function errorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') {
    return fallback;
  }
  const body = data as ApiEnvelope<unknown> & { message?: string };
  return body.errorInfo || body.message || fallback;
}

export const http = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status ?? 0;
    const message = errorMessage(error.response?.data, error.message || 'Request failed');
    return Promise.reject(new ApiError(message, status));
  },
);

export function withToken(token: string): AxiosRequestConfig {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}
