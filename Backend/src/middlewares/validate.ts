import type { RequestHandler } from 'express';
import { z, type ZodType } from 'zod';

/** Body of every superadmin `POST …/bulk-delete`: 1–200 record ids, duplicates dropped. */
export const bulkIdsSchema = z.object({
  ids: z
    .array(z.string().trim().min(1).max(200))
    .min(1, 'Select at least one item to delete.')
    .max(200, 'You can delete at most 200 items at a time.')
    .transform((ids) => [...new Set(ids)]),
});

/** Parses `req.body` with a zod schema; unknown fields are stripped and the parsed value replaces the body. */
export const validateBody =
  (schema: ZodType): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const first = result.error.issues[0];
      return void res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        error: first?.message ?? 'Invalid request.',
        details: result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      });
    }
    req.body = result.data;
    next();
  };
