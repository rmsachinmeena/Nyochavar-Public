import { supabase } from '../config/supabase.js';
import { notificationModel } from '../models/notificationModel.js';
import { notificationEvents } from './notificationEvents.js';
import { triggerAutoWhatsApp } from './whatsappService.js';

// Automatic notifications. Every trigger calls notifyUser(); wording and on/off live in the `notification_templates`
// table (Superadmin edits them), plus a master switch in `notification_settings`.
//
// SECURITY: login / signup / reset OTPs and tokens are never put into a notification. The only code that may appear in
// a message is the delivery OTP, and only inside the rendered text of the "out_for_delivery" template, never in `data`.

const TYPE_BY_CATEGORY = { order: 'order', payment: 'payment', delivery: 'delivery', account: 'account' };
const rupees = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const render = (text, vars) => String(text ?? '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] ?? '').toString());

const loadActiveTemplate = async (eventKey) => {
  const { data: settings } = await supabase.from('notification_settings').select('automatic_enabled').eq('id', 1).maybeSingle();
  if (settings && settings.automatic_enabled === false) return null;

  const { data: template, error } = await supabase.from('notification_templates').select('*').eq('event_key', eventKey).maybeSingle();
  if (error) throw new Error(error.message);
  return template && template.is_active !== false ? template : null;
};

const loadUserName = async (userId) => {
  const { data } = await supabase.from('users').select('name').eq('id', userId).maybeSingle();
  return (data?.name || '').trim().split(' ')[0] || 'there';
};

// The products of an order, read from the products table by each item's product_id (falls back to what the order saved):
// `text` is the short name used inside messages, `items` are the id / name / photo shown in the notification popup
export const loadProducts = async (order) => {
  const items = (Array.isArray(order?.items) ? order.items : []).filter((item) => item && !item.__delivery_meta);
  if (items.length === 0) return { text: '', items: [] };

  const ids = [...new Set(items.map((item) => item.product_id || item.productId).filter(Boolean))];
  const byId = {};
  if (ids.length > 0) {
    const { data } = await supabase.from('products').select('id, name, images').in('id', ids);
    (data || []).forEach((row) => { byId[row.id] = row; });
  }

  const seen = new Set();
  const list = [];
  for (const item of items) {
    const id = item.product_id || item.productId || null;
    const key = id || item.name;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const row = id ? byId[id] : null;
    const firstImage = Array.isArray(row?.images) ? (typeof row.images[0] === 'string' ? row.images[0] : row.images[0]?.url) : null;
    list.push({ product_id: id, name: row?.name || item.name || 'Gift', image: firstImage || item.image || null });
  }

  const names = list.map((entry) => entry.name);
  const text = names.length <= 2 ? names.join(' & ') : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  return { text, items: list.slice(0, 4) };
};

/**
 * Sends one automatic notification. Never throws (a failed notification must not break an order or a payment).
 *
 * @param {string} eventKey  one of the notification_templates.event_key values
 * @param {object} ctx       { userId, order?, riderName?, deliveryOtp? }
 * @returns the created notification, or null when it was switched off, a duplicate, or failed
 */
export const notifyUser = async (eventKey, ctx) => {
  try {
    const { userId, order, riderName, deliveryOtp } = ctx;
    if (!userId) return null;

    const template = await loadActiveTemplate(eventKey);
    if (!template) return null;

    const productInfo = order ? await loadProducts(order) : { text: '', items: [] };

    const vars = {
      name: await loadUserName(userId),
      order_number: order?.order_number || '',
      products: productInfo.text,
      amount: order ? rupees(order.total_amount) : '',
      delivery_slot: order?.delivery_slot || '',
      rider_name: riderName || order?.delivery_partner_name || 'Your delivery partner',
      delivery_otp: deliveryOtp || ''
    };

    const created = await notificationModel.createUnique({
      buyer_id: userId,
      type: TYPE_BY_CATEGORY[template.category] || 'system',
      event_key: eventKey,
      order_id: order?.id || null,
      title: render(template.title, vars),
      message: render(template.message, vars),
      // Opens exactly this order (not the whole order history)
      link: order ? `/profile?tab=orders&order=${encodeURIComponent(order.id)}` : '/profile?tab=notifications',
      // Only non-sensitive facts go into `data` (no OTPs)
      data: order ? { order_number: order.order_number, products: vars.products, items: productInfo.items, amount: Number(order.total_amount) || 0 } : {}
    });

    if (created) notificationEvents.emit('notification', { userId, notification: created });
    if (order) {
      void triggerAutoWhatsApp(eventKey, { order, userId, riderName, deliveryOtp });
    }
    // Note: template.send_email is not wired yet. Only in-app and WhatsApp notifications are sent for now.
    return created;
  } catch (err) {
    console.warn(`⚠️ Notification "${eventKey}" not sent:`, err.message);
    return null;
  }
};
