import { request } from './apiClient';

export type NotificationType = 'order' | 'payment' | 'delivery' | 'account' | 'offer' | 'announcement' | 'system';

export interface AppNotification {
  id: string;
  buyer_id: string;
  title: string;
  message: string | null;
  type: NotificationType;
  link?: string | null;
  order_id?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationTemplate {
  event_key: string;
  category: string;
  label: string;
  title: string;
  message: string;
  is_active: boolean;
  send_email: boolean;
}

export interface NotificationBroadcast {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  audience: 'all' | 'selected' | 'user';
  channels: string[];
  recipient_count: number;
  email_sent_count: number;
  created_at: string;
}

export interface SendNotificationInput {
  title: string;
  message: string;
  link?: string;
  audience: 'all' | 'selected' | 'user';
  userIds?: string[];
  channels: ('in_app' | 'email')[];
}

/** The window event the buyer socket fires for every live notification (see useAuthSocket) */
export const LIVE_NOTIFICATION_EVENT = 'petal:notification';
/** Fired after local changes (marked read) so other mounted lists refresh their counts */
export const NOTIFICATIONS_CHANGED_EVENT = 'petal:notifications-changed';

export const notificationService = {
  // ----- customer -----
  markAllRead: (userId: string) =>
    request(`/user/notifications/${encodeURIComponent(userId)}/read-all`, {
      method: 'PUT',
      role: 'buyer',
      fallbackMessage: 'Could not mark notifications read',
    }),

  // ----- superadmin -----
  getSettings: async (): Promise<{ automatic_enabled: boolean }> =>
    (await request('/admin/notifications/settings', { role: 'superadmin', fallbackMessage: 'Could not load settings' })).settings,

  setAutomaticEnabled: async (automatic_enabled: boolean) =>
    request('/admin/notifications/settings', { method: 'PUT', role: 'superadmin', body: { automatic_enabled }, fallbackMessage: 'Could not update the master switch' }),

  listTemplates: async (): Promise<NotificationTemplate[]> =>
    (await request('/admin/notifications/templates', { role: 'superadmin', fallbackMessage: 'Could not load templates' })).templates,

  updateTemplate: async (eventKey: string, patch: Partial<Pick<NotificationTemplate, 'title' | 'message' | 'is_active' | 'send_email'>>): Promise<NotificationTemplate> =>
    (await request(`/admin/notifications/templates/${encodeURIComponent(eventKey)}`, { method: 'PUT', role: 'superadmin', body: patch, fallbackMessage: 'Could not save the template' })).template,

  listBroadcasts: async (): Promise<NotificationBroadcast[]> =>
    (await request('/admin/notifications/broadcasts', { role: 'superadmin', fallbackMessage: 'Could not load history' })).broadcasts,

  send: async (input: SendNotificationInput): Promise<{ recipients: number }> =>
    request('/admin/notifications/send', { method: 'POST', role: 'superadmin', body: input, fallbackMessage: 'Could not send the message' }),
};
