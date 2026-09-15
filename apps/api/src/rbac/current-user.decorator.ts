import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthedRequest } from './permission.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    return request.authUser;
  },
);

export const CurrentPermissions = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    return request.permissionCodes ?? [];
  },
);
