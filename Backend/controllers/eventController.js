import { clampInt, safeSearchTerm } from '../src/utils/input.js';
import { userEventsModel } from '../models/userEventsModel.js';
import { auditLogger } from '../services/auditLogger.js';

export const eventController = {
  /**
   * NON-BLOCKING Event Ingestion
   * Responds immediately (202 Accepted) to the client so the buyer UI is never blocked.
   * Database insertion is handled asynchronously in the background.
   */
  trackEvent: (req, res) => {
    try {
      const { user_id, session_id, event_type, metadata } = req.body || {};

      // Quick validation for event_type
      if (!event_type) {
        return res.status(400).json({ error: 'event_type is required' });
      }

      if (!userEventsModel.isValidEventType(event_type)) {
        return res.status(400).json({ 
          error: `Invalid event_type '${event_type}'. Only meaningful events allowed: ${userEventsModel.ALLOWED_EVENT_TYPES.join(', ')}` 
        });
      }

      // Prioritize verified authentication principal over unverified body user_id
      const effectiveUserId = req.auth?.id || user_id || null;

      // Send immediate response to client — ZERO latency for the buyer UI
      res.status(202).json({ success: true, queued: true });

      // Asynchronous background execution (fire-and-forget)
      setImmediate(async () => {
        try {
          await userEventsModel.recordEvent({
            user_id: effectiveUserId,
            session_id: session_id || null,
            event_type,
            metadata: metadata || {}
          });
        } catch (bgError) {
          console.error(`[Background Event Tracking Error] Failed to write event '${event_type}':`, bgError.message);
        }
      });
    } catch (err) {
      console.error('Error handling trackEvent request:', err.message);
      return res.status(500).json({ error: 'Failed to process event' });
    }
  },

  /**
   * Stitch anonymous guest session events to an authenticated user
   */
  stitchSession: async (req, res) => {
    try {
      const { session_id, user_id } = req.body || {};
      const effectiveUserId = req.auth?.id || user_id;

      if (!session_id || !effectiveUserId) {
        return res.status(400).json({
          success: false,
          error: 'session_id and user_id are required'
        });
      }

      const count = await userEventsModel.stitchSession(session_id, effectiveUserId);
      return res.status(200).json({
        success: true,
        stitched: count,
        message: `${count} event(s) linked to user ${effectiveUserId}`
      });
    } catch (err) {
      console.error('Error in stitchSession:', err.message);
      return res.status(500).json({ error: 'Failed to stitch session' });
    }
  },

  /**
   * SuperAdmin: Get psychology summary for a specific user
   */
  getUserSummary: async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const summary = await userEventsModel.getUserSummary(userId);
      return res.status(200).json({ success: true, summary });
    } catch (err) {
      console.error('Error in getUserSummary:', err.message);
      return res.status(500).json({ error: err.message || 'Failed to fetch user summary' });
    }
  },

  /**
   * SuperAdmin: Get paginated chronological timeline of raw events
   */
  getUserTimeline: async (req, res) => {
    try {
      const { userId } = req.params;
      const { event_type, limit = 20, offset = 0, order = 'desc' } = req.query;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const timeline = await userEventsModel.getUserTimeline(userId, {
        event_type,
        limit: clampInt(limit, 1, 200, 20),
        offset: clampInt(offset, 0, 100000, 0),
        order: order === 'asc' ? 'asc' : 'desc'
      });

      return res.status(200).json({ success: true, ...timeline });
    } catch (err) {
      console.error('Error in getUserTimeline:', err.message);
      return res.status(500).json({ error: err.message || 'Failed to fetch user timeline' });
    }
  },

  /**
   * SuperAdmin: Get list of users with quick summary metrics for the selector
   */
  getUsersWithSummary: async (req, res) => {
    try {
      const { limit = 50, offset = 0, search } = req.query;
      const result = await userEventsModel.getAllUsersSummary({
        limit: clampInt(limit, 1, 200, 50),
        offset: clampInt(offset, 0, 100000, 0),
        search: safeSearchTerm(search)
      });

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('Error in getUsersWithSummary:', err.message);
      return res.status(500).json({ error: err.message || 'Failed to fetch users summary' });
    }
  },

  /**
   * SuperAdmin: Top-level platform overview
   */
  getOverview: async (req, res) => {
    try {
      const overview = await userEventsModel.getPlatformOverview();
      return res.status(200).json({ success: true, overview });
    } catch (err) {
      console.error('Error in getOverview:', err.message);
      return res.status(500).json({ error: err.message || 'Failed to fetch overview' });
    }
  },

  /**
   * SuperAdmin: Delete one or many shopper activity events. Body: { ids: string[] }
   */
  bulkDeleteEvents: async (req, res) => {
    try {
      const deletedIds = await userEventsModel.deleteMany(req.body.ids);

      await auditLogger.logMany({
        action: 'DELETE_USER_EVENT',
        table_affected: 'user_events',
        record_ids: deletedIds
      });

      return res.status(200).json({
        success: true,
        deleted: deletedIds.length,
        ids: deletedIds,
        message: `${deletedIds.length} activity event(s) deleted successfully`
      });
    } catch (err) {
      console.error('Error in bulkDeleteEvents:', err.message);
      return res.status(err.status || 500).json({ error: err.message || 'Failed to delete activity' });
    }
  }
};
