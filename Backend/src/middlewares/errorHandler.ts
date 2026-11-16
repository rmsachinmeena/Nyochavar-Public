import type { ErrorRequestHandler, RequestHandler } from 'express';
import { env } from '../config/env.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, code: 'NOT_FOUND', error: 'Route not found' });
};

interface HttpishError extends Error {
  status?: number;
  type?: string;
}

/** Last line of defence: anything a controller did not catch ends up here, without leaking internals. */
export  const errorHandler: ErrorRequestHandler = (err: HttpishError, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.type === 'entity.too.large') {
    return void res.status(413).json({ success: false, code: 'PAYLOAD_TOO_LARGE', error: 'Request body is too large.' });
  }
  if (err.type === 'entity.parse.failed') {
    return void res.status(400).json({ success: false, code: 'INVALID_JSON', error: 'Request body is not valid JSON.' });
  }
  if (err.message === 'Not allowed by CORS') {
    return void res.status(403).json({ success: false, code: 'CORS_FORBIDDEN', error: 'Origin not allowed.' });
  }

  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    error: env.isProduction ? 'Something went wrong. Please try again.' : err.message,
  });
};
