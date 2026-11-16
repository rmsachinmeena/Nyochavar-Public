-- The WhatsApp message log now keeps the text of the message and who it was for, so the superadmin can see a list of
-- the messages that were prepared. Run once in the Supabase SQL editor (after 019).

ALTER TABLE whatsapp_message_log ADD COLUMN IF NOT EXISTS message        TEXT;
ALTER TABLE whatsapp_message_log ADD COLUMN IF NOT EXISTS recipient_name TEXT;

NOTIFY pgrst, 'reload schema';
