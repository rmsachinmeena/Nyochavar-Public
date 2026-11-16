import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

/**
 * CSRF guard for the cookie-based endpoints (refresh / logout). The refresh cookie is SameSite=None in
 * production, so a hostile site could otherwise make the browser call these with the cookie attached.
 * Browsers always send Origin on such POSTs, so a foreign Origin is rejected.
 */
export const requireTrustedOrigin: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !env.allowedOrigins.includes(origin)) {
    return void res.status(403).json({ success: false, code: 'CORS_FORBIDDEN', error: 'Origin not allowed.' });
  }
  next();
};

/**
 * Controllers answer 500s with `error.message`, which can be a raw database error. In production every
 * 5xx body is replaced by a generic one (the original is still logged); 4xx messages pass through.
 */
export const hideServerErrorDetails: RequestHandler = (req, res, next) => {
  if (!env.isProduction) return next();

  const originalJson = res.json.bind(res);
  res.json = (body?: unknown) => {
    if (res.statusCode >= 500) {
      console.error(`5xx on ${req.method} ${req.originalUrl}:`, JSON.stringify(body));
      return originalJson({ success: false, code: 'INTERNAL_ERROR', error: 'Something went wrong. Please try again.' });
    }
    return originalJson(body);
  };
  next();
};
