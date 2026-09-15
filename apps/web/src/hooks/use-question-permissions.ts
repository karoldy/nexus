import { hasPermission } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth-store';

export function useQuestionPermissions() {
  const codes = useAuthStore((state) => state.permissionCodes);
  const role = useAuthStore((state) => state.user?.role);
  return {
    canCreate: hasPermission(codes, 'question:create', role),
    canUpdate: hasPermission(codes, 'question:update', role),
    canDelete: hasPermission(codes, 'question:delete', role),
  };
}
