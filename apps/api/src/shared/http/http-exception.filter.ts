import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { errorResponse } from './api-response';
import { ensureRequestId, REQUEST_ID_HEADER } from './request-id';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = ensureRequestId(request);
    response.setHeader(REQUEST_ID_HEADER, requestId);

    const { status, message, errorCode } = normalizeException(exception);
    response.status(status).json(errorResponse(requestId, status, message, errorCode));
  }
}

export function httpErrorCode(status: number, exceptionName?: string): string {
  if (exceptionName) {
    return exceptionName
      .replace(/Exception$/, '')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toUpperCase();
  }
  return HttpStatus[status] ?? 'INTERNAL_SERVER_ERROR';
}

export function extractErrorMessage(body: string | object): string {
  if (typeof body === 'string') {
    return body;
  }
  if ('message' in body) {
    const { message } = body as { message: string | string[] };
    if (Array.isArray(message)) {
      return message.join('; ');
    }
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return 'Request failed';
}

function normalizeException(exception: unknown): {
  status: number;
  message: string;
  errorCode: string;
} {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    return {
      status,
      message: extractErrorMessage(exception.getResponse()),
      errorCode: httpErrorCode(status, exception.name),
    };
  }
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
    errorCode: 'INTERNAL_SERVER_ERROR',
  };
}
