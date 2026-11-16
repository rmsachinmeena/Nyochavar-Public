import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useUI } from '../../context';
import { useAuthSocket } from '../../hooks/useAuthSocket';
import { onSessionEnded, type Role } from '../../services/apiClient';

const SESSION_MESSAGES: Record<string, string> = {
  expired: 'Your session has expired.',
  revoked: 'You were signed out (signed in elsewhere or password changed).',
  deactivated: 'This account is no longer active.',
  missing: 'Please sign in to continue.',
  invalid: 'Your session is no longer valid.',
  rate_limited: 'Rate limit exceeded (too many requests). You have been signed out.',
};

/**
 * Mounted once at the app root. It
 *  - runs the 5-second token check for whichever area the user is in (shopper, superadmin, rider),
 *  - signs the user out cleanly and shows a toast when the server ends a session or on 429 rate limit.
 */
export const AuthSessionGuard: React.FC = () => {
  const { loggedInUser, handleLogout } = useAuth();
  const { showToast } = useUI();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const inAdminArea = pathname.startsWith('/admin') && pathname !== '/admin/login';
  const inRiderArea = pathname.startsWith('/rider');

  useAuthSocket('buyer', Boolean(loggedInUser));
  useAuthSocket('superadmin', inAdminArea);
  useAuthSocket('rider', inRiderArea);

  useEffect(
    () =>
      onSessionEnded(({ role, reason }: { role: Role; reason: string }) => {
        if (reason === 'missing' || reason === 'rate_limited' || reason === 'required') {
          return;
        }

        const message = SESSION_MESSAGES[reason] ?? SESSION_MESSAGES.invalid;
        if (role === 'buyer') {
          handleLogout();
          showToast({
            title: 'Signed out',
            description: message,
            action: { label: 'Sign in', onClick: () => navigate('/auth') },
          });
        } else if (role === 'superadmin') {
          try {
            localStorage.removeItem('petal_pen_admin_auth');
            localStorage.removeItem('petal_pen_admin_profile');
          } catch {
            /* ignore */
          }
          showToast({ title: 'Admin session ended', description: message });
          // Only redirect if currently inside an admin route
          if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
            navigate('/admin/login', { replace: true });
          }
        } else {
          showToast({ title: 'Signed out', description: message });
        }
      }),
    [handleLogout, navigate, pathname, showToast]
  );

  return null;
};

export default AuthSessionGuard;
