-- Customers can "delete" a notification: it is only hidden from their list, the row stays in the table.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
