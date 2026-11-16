import { supabase } from '../config/supabase.js';
import { notificationModel } from '../models/notificationModel.js';
import { notificationEvents } from '../services/notificationEvents.js';
import { emailService } from '../services/emailService.js';
import { auditLogger } from '../services/auditLogger.js';

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const chunk = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

const messageEmail = (title, message, link) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>
    <p style="font-size:15px;line-height:1.6;color:#475569;white-space:pre-line">${escapeHtml(message)}</p>
    ${link ? `<p style="margin-top:20px"><a href="${escapeHtml(link)}" style="background:#0052ff;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Open</a></p>` : ''}
    <p style="margin-top:28px;font-size:12px;color:#94a3b8">Nyochavar</p>
  </div>`;

const fail = (res, error, message) => {
  console.error(message, error);
  return res.status(500).json({ success: false, message: error?.message || message });
};

export const notificationAdminController = {
  getSettings: async (req, res) => {
    try {
      const { data } = await supabase.from('notification_settings').select('*').eq('id', 1).maybeSingle();
      res.status(200).json({ success: true, settings: data || { automatic_enabled: true } });
    } catch (error) {
      fail(res, error, 'Failed to load notification settings');
    }
  },

  updateSettings: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .upsert({ id: 1, automatic_enabled: req.body.automatic_enabled, updated_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw new Error(error.message);
      await auditLogger.log({
        action: `NOTIFICATIONS_AUTOMATIC_${req.body.automatic_enabled ? 'ON' : 'OFF'}`,
        table_affected: 'notification_settings',
        record_id: '1',
      });
      res.status(200).json({ success: true, settings: data });
    } catch (error) {
      fail(res, error, 'Failed to update notification settings');
    }
  },

  listTemplates: async (req, res) => {
    try {
      const { data, error } = await supabase.from('notification_templates').select('*').order('category').order('event_key');
      if (error) throw new Error(error.message);
      res.status(200).json({ success: true, templates: data || [] });
    } catch (error) {
      fail(res, error, 'Failed to load templates');
    }
  },

  updateTemplate: async (req, res) => {
    try {
      const { eventKey } = req.params;
      const { data, error } = await supabase
        .from('notification_templates')
        .update({ ...req.body, updated_at: new Date().toISOString() })
        .eq('event_key', eventKey)
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return res.status(404).json({ success: false, message: 'Template not found' });
      await auditLogger.log({ action: 'NOTIFICATION_TEMPLATE_UPDATED', table_affected: 'notification_templates', record_id: eventKey });
      res.status(200).json({ success: true, template: data });
    } catch (error) {
      fail(res, error, 'Failed to update template');
    }
  },

  listBroadcasts: async (req, res) => {
    try {
      const { data, error } = await supabase.from('notification_broadcasts').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw new Error(error.message);
      res.status(200).json({ success: true, broadcasts: data || [] });
    } catch (error) {
      fail(res, error, 'Failed to load history');
    }
  },

  // Send a message to one user, selected users or everyone, in-app and/or by email
  send: async (req, res) => {
    try {
      const { title, message, link, audience, userIds = [], channels } = req.body;

      // Customers only (never riders / admins)
      let query = supabase.from('users').select('id, email').eq('role', 'buyer');
      if (audience !== 'all') query = query.in('id', userIds);
      const { data: users, error: usersError } = await query;
      if (usersError) throw new Error(usersError.message);
      if (!users || users.length === 0) return res.status(400).json({ success: false, message: 'No matching customers found.' });

      const { data: broadcast, error: broadcastError } = await supabase
        .from('notification_broadcasts')
        .insert([{ title, message, link: link || null, audience, channels, recipient_count: users.length, sent_by: req.auth?.id || null }])
        .select()
        .single();
      if (broadcastError) throw new Error(broadcastError.message);

      // In-app: one row per user (so every user has their own read state), inserted in batches
      if (channels.includes('in_app')) {
        const byUser = new Map();
        for (const batch of chunk(users, 500)) {
          const rows = await notificationModel.createMany(
            batch.map((user) => ({
              buyer_id: user.id,
              type: audience === 'all' ? 'announcement' : 'system',
              title,
              message,
              link: link || null,
              broadcast_id: broadcast.id,
              data: {},
              is_read: false,
            }))
          );
          rows.forEach((row) => byUser.set(row.buyer_id, row));
        }
        notificationEvents.emit('notification-batch', { byUser });
      }

      // Email: sent in the background so a big audience does not hold the request open
      if (channels.includes('email')) {
        const html = messageEmail(title, message, link);
        setImmediate(async () => {
          let sent = 0;
          for (const batch of chunk(users.filter((user) => user.email), 5)) {
            const results = await Promise.all(batch.map((user) => emailService.sendMessage(user.email, title, html)));
            sent += results.filter(Boolean).length;
          }
          await supabase.from('notification_broadcasts').update({ email_sent_count: sent }).eq('id', broadcast.id);
        });
      }

      await auditLogger.log({ action: 'NOTIFICATION_BROADCAST_SENT', table_affected: 'notification_broadcasts', record_id: broadcast.id });
      res.status(201).json({ success: true, broadcast, recipients: users.length });
    } catch (error) {
      fail(res, error, 'Failed to send notification');
    }
  },
};
