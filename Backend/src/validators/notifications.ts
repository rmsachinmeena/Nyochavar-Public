import { z } from 'zod';

export const sendNotificationSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120),
    message: z.string().trim().min(1, 'Message is required').max(1000),
    link: z.string().trim().max(300).optional().or(z.literal('')),
    audience: z.enum(['all', 'selected', 'user']),
    userIds: z.array(z.string().trim().min(1).max(64)).max(1000).optional(),
    channels: z.array(z.enum(['in_app', 'email'])).min(1, 'Choose at least one channel').max(2),
  })
  .refine((v) => v.audience === 'all' || (v.userIds && v.userIds.length > 0), { message: 'Choose at least one user', path: ['userIds'] });

export const updateTemplateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(1000).optional(),
  is_active: z.boolean().optional(),
  send_email: z.boolean().optional(),
});

export const updateNotificationSettingsSchema = z.object({ automatic_enabled: z.boolean() });
