import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../../config/supabase.js';
import { adminModel } from '../../models/adminModel.js';
import { deliveryPartnerModel } from '../../models/deliveryPartnerModel.js';
import { userModel } from '../../models/userModel.js';
import { env } from '../config/env.js';
import { authEvents } from './authEvents.js';

export type Role = 'buyer' | 'superadmin' | 'rider';

export interface AuthPrincipal {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Session id: shared by every token rotated from the same login. */
  sid: string;
  jti: string;
  iat: number;
  exp: number;
}

export type VerifyFailure = 'expired' | 'invalid' | 'revoked';
export type VerifyResult = { ok: true; principal: AuthPrincipal } | { ok: false; reason: VerifyFailure };

interface Identity {
  id: string;
  email: string;
  name: string;
}

export interface IssuedTokens {
  token: string;
  /**
   * Also returned in the JSON body: phone browsers (iOS Safari, installed PWAs, Brave, ...) block the
   * cross-site refresh cookie, so the app keeps this copy and sends it back in the refresh body instead.
   */
  refreshToken: string;
  expiresIn: number;
}

/** 'conflict': a parallel refresh claimed the same token a moment earlier; the client should retry, not sign out. */
export type RefreshFailure = 'missing' | 'invalid' | 'expired' | 'reuse' | 'inactive' | 'conflict';
export type RefreshResult = ({ ok: true; principal: Identity } & IssuedTokens) | { ok: false; reason: RefreshFailure };

const REFRESH_TABLE = 'refresh_tokens';
const ACTIVE_CACHE_TTL_MS = 30_000;
/**
 * A token rotated this recently may come back once more without counting as theft: the phone lost the
 * response carrying its replacement (screen locked / network switched mid-refresh) or two tabs refreshed together.
 */
const ROTATION_GRACE_MS = 60_000;
/** Node sets revoked_at, Postgres sets created_at: allow for the two clocks drifting apart a little. */
const CLOCK_SKEW_MS = 5_000;

const SECRETS: Record<Role, string> = {
  buyer: env.jwt.buyerSecret,
  superadmin: env.jwt.adminSecret,
  rider: env.jwt.riderSecret,
};
const AUDIENCES: Record<Role, string> = {
  buyer: `${env.jwt.issuer}:buyer`,
  superadmin: `${env.jwt.issuer}:admin`,
  rider: `${env.jwt.issuer}:rider`,
};
const COOKIES: Record<Role, string> = { buyer: 'pp_rt_buyer', superadmin: 'pp_rt_admin', rider: 'pp_rt_rider' };

const secretFor = (role: Role): string => SECRETS[role];
const audienceFor = (role: Role): string => AUDIENCES[role];
const cookieNameFor = (role: Role): string => COOKIES[role];
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

// ---------------------------------------------------------------------------
// In-memory revocation (access tokens live <= accessTtl, so entries expire with them).
// Single-instance state: fine for one long-running server; use Redis when scaling out.
// ---------------------------------------------------------------------------
const revokedSessions = new Map<string, number>();
const revokedUsers = new Map<string, number>();
const accountActiveCache = new Map<string, { active: boolean; at: number }>();

const userKey = (role: Role, id: string): string => `${role}:${id}`;

const markSessionRevoked = (sid: string): void => {
  revokedSessions.set(sid, Date.now() + env.jwt.accessTtlSeconds * 1000);
};

const markUserRevoked = (role: Role, id: string): void => {
  revokedUsers.set(userKey(role, id), Date.now());
};

const isRevoked = (principal: AuthPrincipal): boolean => {
  if (revokedSessions.has(principal.sid)) return true;
  const userRevokedAt = revokedUsers.get(userKey(principal.role, principal.id));
  // iat is in whole seconds, so compare at second granularity
  return userRevokedAt !== undefined && principal.iat * 1000 <= userRevokedAt;
};

setInterval(() => {
  const now = Date.now();
  for (const [sid, expiresAt] of revokedSessions) if (expiresAt <= now) revokedSessions.delete(sid);
  const userCutoff = now - env.jwt.accessTtlSeconds * 1000;
  for (const [key, revokedAt] of revokedUsers) if (revokedAt <= userCutoff) revokedUsers.delete(key);
}, 60_000).unref();

// ---------------------------------------------------------------------------
// Access tokens
// ---------------------------------------------------------------------------
export const signAccessToken = (role: Role, identity: Identity, sid: string): string =>
  jwt.sign({ email: identity.email, name: identity.name, role, sid }, secretFor(role), {
    algorithm: 'HS256',
    subject: identity.id,
    issuer: env.jwt.issuer,
    audience: audienceFor(role),
    jwtid: randomUUID(),
    expiresIn: env.jwt.accessTtlSeconds,
  });

type AccessClaims = jwt.JwtPayload & { email?: string; name?: string; sid?: string; role?: string };

export const verifyAccessToken = (token: string, role: Role): VerifyResult => {
  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, secretFor(role), {
      algorithms: ['HS256'],
      issuer: env.jwt.issuer,
      audience: audienceFor(role),
    });
  } catch (error) {
    return { ok: false, reason: error instanceof jwt.TokenExpiredError ? 'expired' : 'invalid' };
  }

  if (typeof decoded === 'string') return { ok: false, reason: 'invalid' };
  const { sub, email, name, sid, jti, iat, exp, role: claimedRole } = decoded as AccessClaims;
  if (!sub || !sid || !jti || !iat || !exp || claimedRole !== role) return { ok: false, reason: 'invalid' };

  const principal: AuthPrincipal = { id: sub, email: email ?? '', name: name ?? '', role, sid, jti, iat, exp };
  if (isRevoked(principal)) return { ok: false, reason: 'revoked' };
  return { ok: true, principal };
};

/** Is the account behind a token still allowed in? Cached for 30s to keep the 5s socket checks cheap. */
export const isAccountActive = async (role: Role, id: string): Promise<boolean> => {
  const key = userKey(role, id);
  const cached = accountActiveCache.get(key);
  if (cached && Date.now() - cached.at < ACTIVE_CACHE_TTL_MS) return cached.active;

  try {
    let active: boolean;
    if (role === 'superadmin') {
      const admin = await adminModel.findById(id);
      active = !!admin && admin.is_active !== false;
    } else if (role === 'rider') {
      // A rider on leave is stored as is_active=false, so only a deleted rider counts as gone here
      active = !!(await deliveryPartnerModel.findById(id));
    } else {
      active = !!(await userModel.findById(id));
    }
    accountActiveCache.set(key, { active, at: Date.now() });
    return active;
  } catch (error) {
    console.error('Account status lookup failed:', (error as Error).message);
    // Database hiccup: keep the last known answer instead of logging everyone out.
    return cached?.active ?? true;
  }
};

export const invalidateAccountCache = (role: Role, id: string): void => {
  accountActiveCache.delete(userKey(role, id));
};

const loadIdentity = async (role: Role, id: string): Promise<Identity | null> => {
  try {
    const record =
      role === 'superadmin'
        ? await adminModel.findById(id)
        : role === 'rider'
          ? await deliveryPartnerModel.findById(id)
          : await userModel.findById(id);
    if (!record) return null;
    // Riders have no email: their phone number takes its place in the token
    return { id: String(record.id), email: String(record.email ?? record.phone ?? ''), name: String(record.name ?? '') };
  } catch (error) {
    console.error('Identity lookup failed:', (error as Error).message);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Refresh tokens (opaque, stored hashed, rotated on every use)
// ---------------------------------------------------------------------------
const refreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.isProduction,
  // Frontend and API live on different sites in production, so the cookie must be cross-site.
  sameSite: env.isProduction ? 'none' : 'lax',
  path: '/api/auth',
  maxAge: env.jwt.refreshTtlSeconds * 1000,
});

const clearCookieOptions = (): CookieOptions => {
  const { maxAge: _maxAge, ...rest } = refreshCookieOptions();
  return rest;
};

/** The refresh token from the cookie, or from the request body when the browser blocked the cookie. */
const presentedRefreshToken = (req: Request, role: Role): string | null => {
  const fromCookie: unknown = req.cookies?.[cookieNameFor(role)];
  if (typeof fromCookie === 'string' && fromCookie) return fromCookie;
  const fromBody: unknown = req.body?.refreshToken;
  return typeof fromBody === 'string' && fromBody ? fromBody : null;
};

const storeRefreshToken = async (role: Role, userId: string, sid: string): Promise<string> => {
  const refreshToken = randomBytes(48).toString('base64url');
  const { error } = await supabase.from(REFRESH_TABLE).insert([
    {
      session_id: sid,
      user_id: userId,
      role,
      token_hash: hashToken(refreshToken),
      expires_at: new Date(Date.now() + env.jwt.refreshTtlSeconds * 1000).toISOString(),
    },
  ]);
  if (error) {
    console.error('Failed to store refresh token (was migration 006 run?):', error.message);
    throw new Error('Could not start a session. Please try again.');
  }
  return refreshToken;
};

/** Start a brand-new login session: returns the access token and sets the refresh-token cookie. */
export const issueSession = async (role: Role, identity: Identity, res: Response): Promise<IssuedTokens> => {
  const sid = randomUUID();
  const refreshToken = await storeRefreshToken(role, identity.id, sid);
  res.cookie(cookieNameFor(role), refreshToken, refreshCookieOptions());
  return { token: signAccessToken(role, identity, sid), refreshToken, expiresIn: env.jwt.accessTtlSeconds };
};

const revokeSessionById = async (sid: string): Promise<void> => {
  markSessionRevoked(sid);
  const { error } = await supabase
    .from(REFRESH_TABLE)
    .update({ revoked_at: new Date().toISOString() })
    .eq('session_id', sid)
    .is('revoked_at', null);
  if (error) console.error('Failed to revoke session:', error.message);
  authEvents.emit('session-revoked', { sid });
};

/** Kill every session of one user (password reset, deactivation, ...). */
export const revokeAllSessionsForUser = async (
  role: Role,
  userId: string,
  reason: 'revoked' | 'deactivated' = 'revoked'
): Promise<void> => {
  markUserRevoked(role, userId);
  invalidateAccountCache(role, userId);
  const { error } = await supabase
    .from(REFRESH_TABLE)
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('role', role)
    .is('revoked_at', null);
  if (error) console.error('Failed to revoke user sessions:', error.message);
  authEvents.emit('user-revoked', { role, userId, reason });
};

/**
 * The id of the still-unused token that replaced this one, if the rotation happened within the grace window.
 * Exactly one newer token, never used, means the client simply missed it; anything else is a replayed token.
 */
const unusedRecentSuccessor = async (row: { id: string; session_id: string; revoked_at: string }): Promise<string | null> => {
  const revokedAt = new Date(row.revoked_at).getTime();
  if (Date.now() - revokedAt > ROTATION_GRACE_MS) return null;

  const { data, error } = await supabase
    .from(REFRESH_TABLE)
    .select('id, revoked_at')
    .eq('session_id', row.session_id)
    .neq('id', row.id)
    .gte('created_at', new Date(revokedAt - CLOCK_SKEW_MS).toISOString());
  const successor = !error && data?.length === 1 ? data[0] : undefined;
  return successor && !successor.revoked_at ? successor.id : null;
};

/** Swap the refresh token for a new one and return a fresh access token. */
export const rotateSession = async (req: Request, res: Response, role: Role): Promise<RefreshResult> => {
  const cookieName = cookieNameFor(role);
  const presented = presentedRefreshToken(req, role);
  if (!presented) return { ok: false, reason: 'missing' };

  const fail = (reason: RefreshFailure): RefreshResult => {
    res.clearCookie(cookieName, clearCookieOptions());
    return { ok: false, reason };
  };

  const { data: row, error } = await supabase
    .from(REFRESH_TABLE)
    .select('id, session_id, user_id, role, expires_at, revoked_at')
    .eq('token_hash', hashToken(presented))
    .maybeSingle();

  if (error || !row || row.role !== role) return fail('invalid');

  // The token to retire in exchange for the new one: normally the presented token itself
  let claimId: string = row.id;
  if (row.revoked_at) {
    const successorId = await unusedRecentSuccessor(row);
    if (!successorId) {
      // A rotated-out token came back: someone copied it. Burn the whole session.
      await revokeSessionById(row.session_id);
      return fail('reuse');
    }
    claimId = successorId;
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) return fail('expired');

  const identity = await loadIdentity(role, row.user_id);
  if (!identity || !(await isAccountActive(role, row.user_id))) {
    await revokeSessionById(row.session_id);
    return fail('inactive');
  }

  // Claim the token first; if a parallel request already did, this one loses. The winner's response
  // carries the new token, so keep the cookie and let the client retry instead of signing it out.
  const { data: claimed } = await supabase
    .from(REFRESH_TABLE)
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', claimId)
    .is('revoked_at', null)
    .select('id');
  if (!claimed || claimed.length === 0) return { ok: false, reason: 'conflict' };

  const nextRefresh = await storeRefreshToken(role, row.user_id, row.session_id);
  res.cookie(cookieName, nextRefresh, refreshCookieOptions());
  return {
    ok: true,
    principal: identity,
    token: signAccessToken(role, identity, row.session_id),
    refreshToken: nextRefresh,
    expiresIn: env.jwt.accessTtlSeconds,
  };
};

/** Logout: revoke the session behind the refresh token and/or the presented access token. */
export const endSession = async (req: Request, res: Response, role: Role, accessSid?: string): Promise<void> => {
  const cookieName = cookieNameFor(role);
  const presented = presentedRefreshToken(req, role);

  const sids = new Set<string>();
  if (accessSid) sids.add(accessSid);
  if (presented) {
    const { data: row } = await supabase
      .from(REFRESH_TABLE)
      .select('session_id, role')
      .eq('token_hash', hashToken(presented))
      .maybeSingle();
    if (row && row.role === role) sids.add(row.session_id);
  }

  await Promise.all([...sids].map(revokeSessionById));
  res.clearCookie(cookieName, clearCookieOptions());
};
