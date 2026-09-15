import { Injectable } from '@nestjs/common';
import { listPermissionCodesForUser } from './permissions';

@Injectable()
export class RbacService {
  listPermissionCodesForUser(userId: string): Promise<string[]> {
    return listPermissionCodesForUser(userId);
  }
}
