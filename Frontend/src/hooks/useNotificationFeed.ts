import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { LIVE_NOTIFICATION_EVENT, NOTIFICATIONS_CHANGED_EVENT, notificationService } from '../services/notificationService';
import type { AppNotification } from '../services/notificationService';

/**
 * The signed-in shopper's notifications: loaded once, updated live when the server pushes a new one,
 * and kept in sync between every mounted list (profile page, bottom-nav badge).
 */
export function useNotificationFeed(userId?: string | null) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));

  const reload = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const data = await api.getUserNotifications(userId);
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.warn('Could not load notifications:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(Boolean(userId));
    void reload();
  }, [reload, userId]);

  useEffect(() => {
    if (!userId) return;
    const onLive = (event: Event) => {
      const incoming = (event as CustomEvent<AppNotification>).detail;
      if (!incoming || incoming.buyer_id !== userId) return;
      setItems((prev) => [incoming, ...prev.filter((item) => item.id !== incoming.id)]);
    };
    const onChanged = () => void reload();
    window.addEventListener(LIVE_NOTIFICATION_EVENT, onLive);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(LIVE_NOTIFICATION_EVENT, onLive);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    };
  }, [userId, reload]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    try {
      await api.markNotificationRead(id);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (err: any) {
      console.warn('Could not mark notification read:', err?.message || err);
    }
  }, []);

  const removeItem = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    try {
      await api.hideNotification(id);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (err: any) {
      console.warn('Could not remove notification:', err?.message || err);
      void reload();
    }
  }, [reload]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    try {
      await notificationService.markAllRead(userId);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
    } catch (err: any) {
      console.warn('Could not mark all read:', err?.message || err);
    }
  }, [userId]);

  const unreadCount = items.filter((item) => !item.is_read).length;
  return { items, loading, unreadCount, markRead, markAllRead, removeItem, reload };
}
