import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../store';

/** Redirects to /login when there's no authenticated user. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAppSelector((s) => s.auth.user);
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
