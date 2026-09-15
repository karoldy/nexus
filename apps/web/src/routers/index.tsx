import { BrowserRouter, Routes } from 'react-router';
import { guestRoutes } from './guest';
import { protectedRoutes } from './protected';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {guestRoutes()}
        {protectedRoutes()}
      </Routes>
    </BrowserRouter>
  );
}
