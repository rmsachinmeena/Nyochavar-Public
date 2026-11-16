import { adminFetch } from './apiClient';
/**
 * Non-blocking event tracking service.
 * Tracks only meaningful user actions (page_view, product_view, search, add_to_cart, etc.).
 * Does NOT track micro-interactions (hover, scroll) to keep data high-value and lightweight.
 * Dispatches requests asynchronously with zero impact on UI responsiveness.
 */

import { API_BASE_URL } from './apiConfig';

export type MeaningfulEventType =
  | 'page_view'
  | 'product_view'
  | 'search'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'wishlist_add'
  | 'checkout_start'
  | 'purchase'
  | 'coupon_applied';

export interface UserSummaryData {
  user_id: string;
  name: string;
  email: string;
  registered_at: string;
  last_active: string | null;
  total_events: number;
  page_views: number;
  product_views: number;
  search_count: number;
  cart_adds: number;
  cart_removes: number;
  wishlist_adds: number;
  checkout_starts: number;
  purchases: number;
  coupons_used: number;
  intent_score: number;
  intent_level: 'High' | 'Medium' | 'Low';
  persona: string;
  conversion_rate: string;
}

export interface UserEventItem {
  id: string;
  user_id: string | null;
  session_id: string;
  event_type: MeaningfulEventType;
  metadata: Record<string, any>;
  created_at: string;
}

// Generate or retrieve persistent anonymous session ID
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('petal_pen_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    sessionStorage.setItem('petal_pen_session_id', sessionId);
  }
  return sessionId;
}

// Retrieve current logged-in user ID if present
function getCurrentUserId(): string | null {
  try {
    const raw = localStorage.getItem('petal_pen_current_user');
    if (raw) {
      const user = JSON.parse(raw);
      return user.id || null;
    }
  } catch (err) {
    // ignore parse error
  }
  return null;
}

export const eventTracker = {
  /**
   * Core non-blocking event dispatcher.
   * Uses navigator.sendBeacon when available or un-awaited fetch with keepalive: true.
   * Buyer UI is never blocked or waiting on response.
   */
  track: (eventType: MeaningfulEventType, metadata: Record<string, any> = {}) => {
    try {
      const payload = {
        user_id: getCurrentUserId(),
        session_id: getSessionId(),
        event_type: eventType,
        metadata
      };

      const url = `${API_BASE_URL}/events`;
      const dataStr = JSON.stringify(payload);

      // 1. Prefer sendBeacon for non-blocking reliability (e.g. unload or page jumps)
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([dataStr], { type: 'application/json' });
        const sent = navigator.sendBeacon(url, blob);
        if (sent) return;
      }

      // 2. Non-blocking asynchronous fetch with keepalive
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: dataStr,
        keepalive: true
      }).catch((err) => {
        // Silently catch tracking errors so UI is completely unaffected
        console.debug('[EventTracker] Non-blocking dispatch failed silently:', err);
      });
    } catch (e) {
      console.debug('[EventTracker] Ignored track error:', e);
    }
  },

  // Semantic Tracking Helpers for meaningful events
  trackPageView: (pageName: string, meta: Record<string, any> = {}) => {
    eventTracker.track('page_view', { page: pageName, url: window.location.pathname, ...meta });
  },

  trackProductView: (product: { id: string; name: string; price?: number; category?: string }) => {
    eventTracker.track('product_view', {
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      category: product.category
    });
  },

  trackSearch: (query: string, resultsCount?: number) => {
    if (!query || !query.trim()) return;
    eventTracker.track('search', { query: query.trim(), results_count: resultsCount });
  },

  trackAddToCart: (item: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    has_custom_message?: boolean;
    selected_hue?: string;
    addons_count?: number;
  }) => {
    eventTracker.track('add_to_cart', {
      product_id: item.productId,
      product_name: item.name,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.price * item.quantity,
      has_custom_message: Boolean(item.has_custom_message),
      selected_hue: item.selected_hue,
      addons_count: item.addons_count || 0
    });
  },

  trackRemoveFromCart: (item: { productId: string; name: string; price: number }) => {
    eventTracker.track('remove_from_cart', {
      product_id: item.productId,
      product_name: item.name,
      price: item.price
    });
  },

  trackWishlistAdd: (product: { id: string; name: string; price?: number }) => {
    eventTracker.track('wishlist_add', {
      product_id: product.id,
      product_name: product.name,
      price: product.price
    });
  },

  trackCheckoutStart: (data: { itemCount: number; totalAmount: number; items?: any[] }) => {
    eventTracker.track('checkout_start', {
      item_count: data.itemCount,
      total_amount: data.totalAmount,
      items: data.items
    });
  },

  trackDeliverySlotSelected: (data: { day: string; slot: string; date?: string }) => {
    eventTracker.track('checkout_start', {
      step: 'delivery_slot_selected',
      delivery_day: data.day,
      delivery_slot: data.slot,
      delivery_date: data.date
    });
  },

  trackPurchase: (data: { orderId: string; totalAmount: number; itemCount: number }) => {
    eventTracker.track('purchase', {
      order_id: data.orderId,
      total_amount: data.totalAmount,
      item_count: data.itemCount
    });
  },

  trackCouponApplied: (data: { code: string; discountPercent?: number; discountAmount?: number; success?: boolean }) => {
    eventTracker.track('coupon_applied', {
      coupon_code: data.code,
      discount_percent: data.discountPercent,
      discount_amount: data.discountAmount,
      success: data.success !== false
    });
  },

  // SuperAdmin Data Fetching APIs
  fetchUsersSummary: async (params?: { search?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));

    const res = await adminFetch(`${API_BASE_URL}/events/users?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch users summary');
    return res.json();
  },

  fetchUserSummary: async (userId: string): Promise<{ success: boolean; summary: UserSummaryData }> => {
    const res = await adminFetch(`${API_BASE_URL}/events/users/${userId}/summary`);
    if (!res.ok) throw new Error('Failed to fetch user psychology summary');
    return res.json();
  },

  fetchUserTimeline: async (
    userId: string,
    params?: { event_type?: string; limit?: number; offset?: number; order?: string }
  ): Promise<{
    success: boolean;
    events: UserEventItem[];
    total: number;
    limit: number;
    offset: number;
    page: number;
    totalPages: number;
  }> => {
    const query = new URLSearchParams();
    if (params?.event_type) query.append('event_type', params.event_type);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    if (params?.order) query.append('order', params.order);

    const res = await adminFetch(`${API_BASE_URL}/events/users/${userId}/timeline?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch user timeline');
    return res.json();
  },

  fetchPlatformOverview: async () => {
    const res = await adminFetch(`${API_BASE_URL}/events/overview`);
    if (!res.ok) throw new Error('Failed to fetch platform overview');
    return res.json();
  },

  fetchAccountCounts: async (): Promise<{ all: number; today: number; last7days: number }> => {
    try {
      const res = await adminFetch(`${API_BASE_URL}/events/users?limit=1000`);
      if (res.ok) {
        const data = await res.json();
        const userList = data.users || [];
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

        let today = 0;
        let last7days = 0;
        userList.forEach((u: any) => {
          const t = new Date(u.registered_at || u.created_at).getTime();
          if (!isNaN(t)) {
            if (t >= startOfToday) today++;
            if (t >= sevenDaysAgo) last7days++;
          }
        });
        return {
          all: data.total || userList.length,
          today,
          last7days
        };
      }
    } catch (err) {
      console.error('Error fetching account counts:', err);
    }
    return { all: 0, today: 0, last7days: 0 };
  }
};
