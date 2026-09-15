import { useAuthStore } from '@/stores/auth-store';

export function useKnowledgePermissions() {
  const codes = useAuthStore((state) => state.permissionCodes);
  return {
    canCreate: codes.includes('knowledge:create'),
    canUpdate: codes.includes('knowledge:update'),
    canDelete: codes.includes('knowledge:delete'),
  };
}
