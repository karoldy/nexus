import { Route } from 'react-router';
import { ProtectedRoute } from '@/components/route-gates';
import { HomePage } from '@/pages/home-page';
import { paths } from './paths';

export function protectedRoutes() {
  return (
    <Route element={<ProtectedRoute />}>
      <Route path={paths.home} element={<HomePage />} />
    </Route>
  );
}
