-- Each automatic notification has ONE unique identity, so messages never mix between users or orders and the
-- same event is never delivered twice (e.g. a retried payment verification):
--   order / payment / delivery events -> unique per (user, event, order)
--   account events (welcome)          -> unique per (user, event)
-- Admin broadcasts have no event_key, so they are not affected. Run in the Supabase SQL editor.

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_order_event
  ON notifications (buyer_id, event_key, order_id)
  WHERE event_key IS NOT NULL AND order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_account_event
  ON notifications (buyer_id, event_key)
  WHERE event_key IS NOT NULL AND order_id IS NULL;

NOTIFY pgrst, 'reload schema';
