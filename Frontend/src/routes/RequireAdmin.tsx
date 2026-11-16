import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { ensureSession } from '../services/session';

/**
 * Lets a request into /admin only when a real superadmin session exists: a valid access token, or one that can be
 * renewed from the refresh cookie. (The old check just looked for a "true" flag in localStorage.)
 */
export const RequireAdmin: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'ok' | 'none'>('checking');

  useEffect(() => {
    let cancelled = false;
    let hint = false;
    try {
      hint = localStorage.getItem('petal_pen_admin_auth') === 'true';
    } catch {
      /* storage unavailable */
    }
    ensureSession('superadmin', hint).then((ok) => {
      if (!cancelled) setStatus(ok ? 'ok' : 'none');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50" role="status" aria-label="Checking session">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      </div>
    );
  }

  if (status === 'none') {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
};

export default RequireAdmin;
