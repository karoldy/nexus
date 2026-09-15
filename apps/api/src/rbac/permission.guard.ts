import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/auth';
import { bearerToken, loadActiveUser, looksLikeJwt, verifyAccessJwt } from '../auth/access-jwt';
import { hasAllPermissions } from './permissions';
import { PERMISSIONS_KEY } from './require-permissions.decorator';
import { RbacService } from './rbac.service';

export type AuthedRequest = Request & {
  authUser?: { id: string; email: string; name: string };
  permissionCodes?: string[];
};

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const user = await this.resolveUser(request);
    if (!user) {
      throw new UnauthorizedException();
    }

    const codes = await this.rbac.listPermissionCodesForUser(user.id);
    request.authUser = user;
    request.permissionCodes = codes;

    if (required.length > 0 && !hasAllPermissions(codes, required)) {
      throw new ForbiddenException();
    }

    return true;
  }

  private async resolveUser(request: AuthedRequest) {
    const token = bearerToken(request.headers.authorization);
    if (token && looksLikeJwt(token)) {
      const payload = await verifyAccessJwt(token);
      if (!payload?.sub) {
        return null;
      }
      return loadActiveUser(payload.sub);
    }

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session?.user) {
      return null;
    }
    return loadActiveUser(session.user.id);
  }
}
