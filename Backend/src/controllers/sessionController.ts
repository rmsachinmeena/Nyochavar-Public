import type { Request, RequestHandler } from 'express';
import { endSession, rotateSession, verifyAccessToken, type Role } from '../services/tokenService.js';

const bearerSid = (req: Request, role: Role): string | undefined => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;
  // An expired token still names its session, but verify() only returns a principal for live ones.
  const result = verifyAccessToken(token, role);
  return result.ok ? result.principal.sid : undefined;
};

/** POST /api/auth/refresh | /api/auth/admin/refresh: trade the refresh cookie for a new access token. */
export const refreshSession =
  (role: Role): RequestHandler =>
  async (req, res) => {
    const result = await rotateSession(req, res, role);
    if (!result.ok) {
      if (result.reason === 'conflict') {
        return void res.status(409).json({
          success: false,
          code: 'REFRESH_CONFLICT',
          error: 'Session is being renewed. Please retry.',
        });
      }
      return void res.status(401).json({
        success: false,
        code: `REFRESH_${result.reason.toUpperCase()}`,
        error: 'Your session has expired. Please sign in again.',
      });
    }

    const { id, name, email } = result.principal;
    res.status(200).json({
      success: true,
      token: result.token,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      ...(role === 'buyer'
        ? { user: { id, name, email } }
        : role === 'superadmin'
          ? { admin: { id, name, email, role } }
          : { rider: { id, name, phone: email } }),
    });
  };

/** POST /api/auth/logout | /api/auth/admin/logout: revoke the session and clear the cookie. */
export const logoutSession =
  (role: Role): RequestHandler =>
  async (req, res) => {
    await endSession(req, res, role, bearerSid(req, role));
    res.status(200).json({ success: true, message: 'Signed out' });
  };

/** GET /api/auth/check: HTTP twin of the socket `token:check`, for clients that cannot hold a socket open. */
export const checkSession: RequestHandler = (req, res) => {
  const auth = req.auth;
  if (!auth) return void res.status(401).json({ success: false, code: 'AUTH_REQUIRED', error: 'Authentication required.' });
  res.status(200).json({
    success: true,
    valid: true,
    role: auth.role,
    expiresIn: Math.max(0, auth.exp - Math.floor(Date.now() / 1000)),
    user: { id: auth.id, name: auth.name, email: auth.email },
  });
};
