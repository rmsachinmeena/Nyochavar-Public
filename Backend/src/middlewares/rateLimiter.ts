import express, { type RequestHandler, type Router } from 'express';
import { DEFAULT_RULE, RATE_LIMIT_OVERRIDES, type RateLimitRule } from '../config/rateLimits.js';

interface Bucket {
  count: number;
  windowStart: number;
  blockedUntil: number;
}

const buckets = new Map<string, Bucket>();

const normalizePath = (path: string): string => (path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path);

const ruleFor = (routeKey: string): RateLimitRule => ({ ...DEFAULT_RULE, ...RATE_LIMIT_OVERRIDES[routeKey] });

// Drop buckets that are neither blocked nor inside an active window.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.blockedUntil <= now && now - bucket.windowStart >= DEFAULT_RULE.windowMs) buckets.delete(key);
  }
}, 60_000).unref();

/**
 * Counts hits per client IP per *route pattern* (so /products/1 and /products/2 share one counter).
 * Over the limit => 429 and the caller is blocked for `blockMs` (60s by default).
 */
export const rateLimit =
  (routePath: string): RequestHandler =>
  (req, res, next) => {
    const routeKey = `${req.method} ${normalizePath(req.baseUrl + routePath)}`;
    const rule = ruleFor(routeKey);
    const key = `${req.ip}|${routeKey}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { count: 0, windowStart: now, blockedUntil: 0 };
      buckets.set(key, bucket);
    }

    if (bucket.blockedUntil > now) return tooMany(res, Math.ceil((bucket.blockedUntil - now) / 1000), rule);

    if (now - bucket.windowStart >= rule.windowMs) {
      bucket.count = 0;
      bucket.windowStart = now;
    }

    bucket.count += 1;
    if (bucket.count > rule.limit) {
      bucket.blockedUntil = now + rule.blockMs;
      return tooMany(res, Math.ceil(rule.blockMs / 1000), rule);
    }

    res.setHeader('X-RateLimit-Limit', String(rule.limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rule.limit - bucket.count)));
    next();
  };

const tooMany = (res: Parameters<RequestHandler>[1], retryAfter: number, rule: RateLimitRule): void => {
  res.setHeader('Retry-After', String(retryAfter));
  res.setHeader('X-RateLimit-Limit', String(rule.limit));
  res.setHeader('X-RateLimit-Remaining', '0');
  res.status(429).json({
    success: false,
    code: 'RATE_LIMITED',
    retryAfter,
    error: `Too many requests. Please wait ${retryAfter} seconds before trying again.`,
  });
};

const ROUTE_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/**
 * Drop-in replacement for `express.Router()`: every route registered on it gets its own
 * rate-limit counter automatically, so no endpoint can be forgotten.
 */
export const createRouter = (): Router => {
  const router = express.Router();
  for (const method of ROUTE_METHODS) {
    const original = router[method].bind(router) as (path: string, ...handlers: RequestHandler[]) => Router;
    (router as unknown as Record<string, unknown>)[method] = (path: string, ...handlers: RequestHandler[]) =>
      original(path, rateLimit(path), ...handlers);
  }
  return router;
};
