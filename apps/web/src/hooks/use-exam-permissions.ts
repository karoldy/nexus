import { hasPermission } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth-store';

export function useExamPermissions() {
  const codes = useAuthStore((state) => state.permissionCodes);
  const role = useAuthStore((state) => state.user?.role);
  return {
    canCreate: hasPermission(codes, 'exam:create', role),
    canUpdate: hasPermission(codes, 'exam:update', role),
    canDelete: hasPermission(codes, 'exam:delete', role),
  };
}
