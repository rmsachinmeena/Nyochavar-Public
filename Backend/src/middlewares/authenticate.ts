import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { setContextAuth } from '../services/requestContext.js';
import { isAccountActive, verifyAccessToken, type Role, type VerifyFailure } from '../services/tokenService.js';

const ALL_ROLES: readonly Role[] = ['buyer', 'superadmin', 'rider'];

const extractBearer = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
};

const reject = (res: Response, status: number, code: string, message: string): void => {
  res.status(status).json({ success: false, error: message, code });
};

const FAILURE_RANK: Record<VerifyFailure, number> = { invalid: 0, revoked: 1, expired: 2 };
const FAILURE_MESSAGE: Record<VerifyFailure, [string, string]> = {
  expired: ['TOKEN_EXPIRED', 'Your session has expired. Please sign in again.'],
  revoked: ['TOKEN_REVOKED', 'Your session was ended. Please sign in again.'],
  invalid: ['TOKEN_INVALID', 'Invalid authentication token.'],
};

/**
 * Verifies the `Authorization: Bearer <access token>` header against the secrets of the allowed roles.
 * A token that is valid but belongs to another role gets 403; anything else gets 401.
 */
export const authenticate =
  (...allowed: Role[]): RequestHandler =>
  async (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearer(req);
    if (!token) return reject(res, 401, 'AUTH_REQUIRED', 'Authentication required.');

    let worstFailure: VerifyFailure = 'invalid';
    for (const role of allowed) {
      const result = verifyAccessToken(token, role);
      if (result.ok) {
        if (!(await isAccountActive(role, result.principal.id))) {
          return reject(res, 401, 'ACCOUNT_DISABLED', 'This account is no longer active.');
        }
        req.auth = result.principal;
        setContextAuth(result.principal);
        return next();
      }
      if (FAILURE_RANK[result.reason] > FAILURE_RANK[worstFailure]) worstFailure = result.reason;
    }

    const otherRoles = ALL_ROLES.filter((role) => !allowed.includes(role));
    if (otherRoles.some((role) => verifyAccessToken(token, role).ok)) {
      return reject(res, 403, 'FORBIDDEN_ROLE', 'You do not have permission to access this resource.');
    }

    const [code, message] = FAILURE_MESSAGE[worstFailure];
    return reject(res, 401, code, message);
  };

export const requireBuyer = authenticate('buyer');
export const requireAdmin = authenticate('superadmin');
export const requireRider = authenticate('rider');
export const requireAuth = authenticate('buyer', 'superadmin');

/**
 * Non-blocking optional authentication.
 * If a valid Bearer token is present, populates `req.auth` and request context.
 * If token is absent or invalid, proceeds without rejecting (for guest / anonymous tracking).
 */
export const optionalAuth: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractBearer(req);
  if (!token) return next();
  for (const role of ['buyer', 'superadmin'] as const) {
    const result = verifyAccessToken(token, role);
    if (result.ok) {
      if (await isAccountActive(role, result.principal.id)) {
        req.auth = result.principal;
        setContextAuth(result.principal);
      }
      return next();
    }
  }
  return next();
};

/** A buyer/rider may only touch their own record (matched by id or email); admins may touch any. */
const matchesSelf = (paramName: string): RequestHandler => (req, res, next) => {
  const auth = req.auth;
  if (!auth) return reject(res, 401, 'AUTH_REQUIRED', 'Authentication required.');
  if (auth.role === 'superadmin') return next();

  const target = String(req.params[paramName] ?? '').toLowerCase();
  if (target && (target === auth.id.toLowerCase() || target === auth.email.toLowerCase())) return next();
  return reject(res, 403, 'FORBIDDEN_OWNER', 'You can only access your own data.');
};

export const requireSelfOrAdmin = (paramName: string): RequestHandler[] => [requireAuth, matchesSelf(paramName)];
export const requireBuyerSelf = (paramName: string): RequestHandler[] => [requireBuyer, matchesSelf(paramName)];
export const requireRiderSelf = (paramName: string): RequestHandler[] => [requireRider, matchesSelf(paramName)];
