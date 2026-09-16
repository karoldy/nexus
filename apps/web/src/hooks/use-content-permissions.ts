import { hasPermission } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth-store';

export function useContentPermissions() {
  const codes = useAuthStore((state) => state.permissionCodes);
  const role = useAuthStore((state) => state.user?.role);
  return {
    canCreate: hasPermission(codes, 'content:create', role),
    canUpdate: hasPermission(codes, 'content:update', role),
    canDelete: hasPermission(codes, 'content:delete', role),
  };
}
