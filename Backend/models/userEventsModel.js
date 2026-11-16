import { supabase } from '../config/supabase.js';

export const ALLOWED_EVENT_TYPES = [
  'page_view',
  'product_view',
  'search',
  'add_to_cart',
  'remove_from_cart',
  'wishlist_add',
  'checkout_start',
  'purchase',
  'coupon_applied'
];

export const userEventsModel = {
  ALLOWED_EVENT_TYPES,

  isValidEventType: (eventType) => {
    return ALLOWED_EVENT_TYPES.includes(eventType);
  },

  // Record a single event into generic user_events table
  recordEvent: async (eventData) => {
    const { user_id, session_id, event_type, metadata = {} } = eventData;

    if (!ALLOWED_EVENT_TYPES.includes(event_type)) {
      throw new Error(`Invalid event_type '${event_type}'. Only meaningful events are allowed.`);
    }

    // Sanitize metadata to protect against memory or DB bloat (cap to 16KB JSON)
    let safeMetadata = {};
    if (typeof metadata === 'object' && metadata !== null) {
      try {
        const jsonStr = JSON.stringify(metadata);
        if (jsonStr.length <= 16384) {
          safeMetadata = JSON.parse(jsonStr);
        } else {
          safeMetadata = { _truncated: true, ...JSON.parse(jsonStr.substring(0, 4096) + '}') };
        }
      } catch (e) {
        safeMetadata = {};
      }
    }

    const payload = {
      user_id: user_id ? String(user_id).trim() : null,
      session_id: session_id ? String(session_id).trim() : null,
      event_type,
      metadata: safeMetadata
    };

    const { data, error } = await supabase
      .from('user_events')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error recording user event:', error.message);
      throw new Error(error.message);
    }

    // Auto-stitch previous guest events for this session if authenticated user_id is now known
    if (payload.user_id && payload.session_id) {
      userEventsModel.stitchSession(payload.session_id, payload.user_id).catch(() => {});
    }

    return data;
  },

  // Link anonymous guest events of a session to an authenticated user
  stitchSession: async (sessionId, userId) => {
    if (!sessionId || !userId) return 0;
    try {
      const cleanSessionId = String(sessionId).trim();
      const cleanUserId = String(userId).trim();

      const { data, error } = await supabase
        .from('user_events')
        .update({ user_id: cleanUserId })
        .eq('session_id', cleanSessionId)
        .is('user_id', null)
        .select('id');

      if (error) {
        console.warn(`[UserEvents] Could not stitch session ${cleanSessionId} to ${cleanUserId}:`, error.message);
        return 0;
      }

      if (data && data.length > 0) {
        console.log(`🔗 [UserEvents] Stitched ${data.length} guest event(s) from session ${cleanSessionId} to user ${cleanUserId}`);
      }
      return data?.length || 0;
    } catch (e) {
      console.warn('[UserEvents] Exception in stitchSession:', e.message);
      return 0;
    }
  },

  // Fetch single user psychology summary (attempts view first, falls back to dynamic aggregation)
  getUserSummary: async (userId) => {
    try {
      // 1. Try querying the user_activity_summary view
      const { data, error } = await supabase
        .from('user_activity_summary')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        return userEventsModel._enrichUserPsychology(data);
      }
    } catch (err) {
      // View might not be created yet, fallback gracefully to dynamic aggregation
    }

    // 2. Fallback: Aggregate dynamically from user_events & users table
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, created_at')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new Error(userError?.message || 'User not found');
    }

    const { data: events, error: eventsError } = await supabase
      .from('user_events')
      .select('event_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const rawList = events || [];
    const counts = {
      user_id: user.id,
      name: user.name,
      email: user.email,
      registered_at: user.created_at,
      last_active: rawList.length > 0 ? rawList[0].created_at : null,
      total_events: rawList.length,
      page_views: rawList.filter(e => e.event_type === 'page_view').length,
      product_views: rawList.filter(e => e.event_type === 'product_view').length,
      search_count: rawList.filter(e => e.event_type === 'search').length,
      cart_adds: rawList.filter(e => e.event_type === 'add_to_cart').length,
      cart_removes: rawList.filter(e => e.event_type === 'remove_from_cart').length,
      wishlist_adds: rawList.filter(e => e.event_type === 'wishlist_add').length,
      checkout_starts: rawList.filter(e => e.event_type === 'checkout_start').length,
      purchases: rawList.filter(e => e.event_type === 'purchase').length,
      coupons_used: rawList.filter(e => e.event_type === 'coupon_applied').length
    };

    return userEventsModel._enrichUserPsychology(counts);
  },

  // Compute psychology metrics and persona tags
  _enrichUserPsychology: (stats) => {
    const {
      page_views = 0,
      product_views = 0,
      search_count = 0,
      cart_adds = 0,
      cart_removes = 0,
      wishlist_adds = 0,
      checkout_starts = 0,
      purchases = 0,
      coupons_used = 0
    } = stats;

    // Buying Intent Score (0 - 100)
    let score = (product_views * 2) + (search_count * 3) + (wishlist_adds * 5) + (cart_adds * 10) + (checkout_starts * 15) + (purchases * 30);
    const intent_score = Math.min(100, Math.round(score));

    // Determine Intent Level
    let intent_level = 'Low';
    if (intent_score >= 60 || purchases > 0) intent_level = 'High';
    else if (intent_score >= 25 || cart_adds > 0 || wishlist_adds > 0) intent_level = 'Medium';

    // Persona Tag / Psychological Classification
    let persona = 'Casual Browser';
    if (purchases >= 3) {
      persona = 'Power Buyer';
    } else if (purchases > 0) {
      persona = 'Converted Customer';
    } else if (cart_adds > 0 && purchases === 0) {
      persona = 'Cart Abandoner';
    } else if (coupons_used > 0 && purchases === 0) {
      persona = 'Bargain Hunter';
    } else if (product_views >= 5 || search_count >= 3) {
      persona = 'High Intent Window Shopper';
    } else if (wishlist_adds > 0) {
      persona = 'Wishlist Curator';
    }

    // Conversion rate calculation
    const conversion_rate = product_views > 0 ? ((purchases / product_views) * 100).toFixed(1) : '0.0';

    return {
      ...stats,
      intent_score,
      intent_level,
      persona,
      conversion_rate: `${conversion_rate}%`
    };
  },

  // Fetch paginated, chronological timeline of raw events for a specific user
  getUserTimeline: async (userId, options = {}) => {
    const {
      event_type,
      limit = 20,
      offset = 0,
      order = 'desc'
    } = options;

    let query = supabase
      .from('user_events')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    if (event_type && event_type !== 'all') {
      query = query.eq('event_type', event_type);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error(`Error fetching timeline for user ${userId}:`, error.message);
      throw new Error(error.message);
    }

    return {
      events: data || [],
      total: count || 0,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil((count || 0) / limit)
    };
  },

  // Fetch list of users with summary metrics for the SuperAdmin selector
  getAllUsersSummary: async (options = {}) => {
    const { limit = 50, offset = 0, search } = options;

    try {
      let query = supabase
        .from('user_activity_summary')
        .select('*', { count: 'exact' })
        .order('last_active', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, count, error } = await query;
      if (!error && data) {
        const enriched = data.map(u => userEventsModel._enrichUserPsychology(u));
        return { users: enriched, total: count || 0 };
      }
    } catch (err) {
      // Fallback if view doesn't exist
    }

    // Fallback using users table
    let userQuery = supabase
      .from('users')
      .select('id, name, email, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      userQuery = userQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, count, error } = await userQuery;
    if (error) throw new Error(error.message);

    const userList = users || [];
    const userIds = userList.map((u) => u.id).filter(Boolean);

    // Single batch query for all users in the page instead of N separate queries
    const eventsByUser = {};
    if (userIds.length > 0) {
      const { data: allEvents } = await supabase
        .from('user_events')
        .select('user_id, event_type, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      (allEvents || []).forEach((e) => {
        if (!eventsByUser[e.user_id]) eventsByUser[e.user_id] = [];
        eventsByUser[e.user_id].push(e);
      });
    }

    const enrichedList = userList.map((u) => {
      const rawList = eventsByUser[u.id] || [];
      const counts = {
        user_id: u.id,
        name: u.name,
        email: u.email,
        registered_at: u.created_at,
        last_active: rawList.length > 0 ? rawList[0].created_at : null,
        total_events: rawList.length,
        page_views: rawList.filter((e) => e.event_type === 'page_view').length,
        product_views: rawList.filter((e) => e.event_type === 'product_view').length,
        search_count: rawList.filter((e) => e.event_type === 'search').length,
        cart_adds: rawList.filter((e) => e.event_type === 'add_to_cart').length,
        cart_removes: rawList.filter((e) => e.event_type === 'remove_from_cart').length,
        wishlist_adds: rawList.filter((e) => e.event_type === 'wishlist_add').length,
        checkout_starts: rawList.filter((e) => e.event_type === 'checkout_start').length,
        purchases: rawList.filter((e) => e.event_type === 'purchase').length,
        coupons_used: rawList.filter((e) => e.event_type === 'coupon_applied').length
      };
      return userEventsModel._enrichUserPsychology(counts);
    });

    return {
      users: enrichedList,
      total: count || 0
    };
  },

  // Platform-wide overview metrics
  getPlatformOverview: async () => {
    const { data: events, error } = await supabase
      .from('user_events')
      .select('event_type, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Error fetching platform overview:', error.message);
      return {
        total_events: 0,
        unique_active_users: 0,
        event_breakdown: {}
      };
    }

    const list = events || [];
    const uniqueUsers = new Set(list.map(e => e.user_id).filter(Boolean));
    const breakdown = {};
    for (const item of list) {
      breakdown[item.event_type] = (breakdown[item.event_type] || 0) + 1;
    }

    return {
      total_events_sample: list.length,
      unique_active_users: uniqueUsers.size,
      event_breakdown: breakdown
    };
  },

  // Delete individual activity events by id. Returns the deleted ids.
  deleteMany: async (ids) => {
    const { data, error } = await supabase
      .from('user_events')
      .delete()
      .in('id', ids)
      .select('id');

    if (error) {
      console.error('Error deleting user events:', error.message);
      throw new Error(error.message);
    }
    return (data || []).map((row) => row.id);
  }
};
