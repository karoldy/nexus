import { describe, expect, it } from 'vitest';
import { hasAllPermissions, isAdminRole, permissionCodes } from './permissions';

describe('permissionCodes', () => {
  it('includes knowledge CRUD', () => {
    expect(permissionCodes()).toEqual(
      expect.arrayContaining([
        'knowledge:read',
        'knowledge:create',
        'knowledge:update',
        'knowledge:delete',
      ]),
    );
  });
});

describe('hasAllPermissions', () => {
  it('allows when every required code is granted', () => {
    expect(hasAllPermissions(['knowledge:read', 'task:read'], ['knowledge:read'])).toBe(true);
  });

  it('denies when a required code is missing', () => {
    expect(hasAllPermissions(['knowledge:read'], ['knowledge:create'])).toBe(false);
  });
});

describe('isAdminRole', () => {
  it('matches the Better Auth admin role string', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('user')).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});
