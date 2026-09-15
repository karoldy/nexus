import { Navigate, Outlet } from 'react-router';
import { paths } from '@/routers/paths';
import { useAuthStore } from '@/stores/auth-store';

export function ProtectedRoute() {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  if (!sessionToken) {
    return <Navigate to={paths.login} replace />;
  }
  return <Outlet />;
}

export function GuestRoute() {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  if (sessionToken) {
    return <Navigate to={paths.home} replace />;
  }
  return <Outlet />;
}
