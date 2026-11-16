import { supabase } from '../config/supabase.js';
import { whatsappBotService } from './whatsappBotService.js';
import { WHATSAPP_IMAGES, whatsappImageUrl } from '../config/whatsappImages.js';

// "Click to send" WhatsApp messages without the paid API: the backend prepares the text and a wa.me link, the
// superadmin opens it, WhatsApp shows the message ready to go, and the admin only presses Send.
//
// SECURITY: the delivery OTP is never put in these messages (they go out from the admin's own phone).

export const BRAND = 'Nyochavar';

// The words an admin may use in a template: {{name}} and so on
export const PLACEHOLDERS = [
  'name',
  'order_name',
  'order_number',
  'products',
  'delivery_date',
  'delivery_time',
  'rider_name',
  'rider_phone',
  'amount',
  'brand',
];

const rupees = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

/**
 * An Indian number in the form wa.me wants (country code, digits only), or null when it cannot be one.
 *  9876543210 -> 919876543210   +91 98765 43211 -> 919876543211   09876543210 -> 919876543210
 */
export const normalizePhone = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
};

/** "2026-10-24" -> "Sat, 24 Oct" */
export const formatDeliveryDay = (value) => {
  const day = value ? new Date(`${value}T00:00:00`) : null;
  if (!day || Number.isNaN(day.getTime())) return value || 'the chosen date';
  return day.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

/** "Morning (9 AM – 12 PM)" -> "before 12 PM" */
export const formatDeliveryTime = (slot) => {
  const times = [...String(slot || '').matchAll(/(\d{1,2}(?::\d{2})?)\s*(AM|PM)/gi)];
  const last = times[times.length - 1];
  return last ? `before ${last[1]} ${last[2].toUpperCase()}` : slot || 'during the day';
};

/** Fills {{placeholders}}; a placeholder with no value (or one that is not allowed) becomes empty. */
export const renderTemplate = (text, values) =>
  String(text ?? '')
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => (PLACEHOLDERS.includes(key) ? values[key] ?? '' : ''))
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

/** Who the message goes to: the recipient's number first, the buyer's own number if there is none. */
export const pickContact = (order, buyer) => {
  const recipientPhone = normalizePhone(order.recipient_phone);
  if (recipientPhone) return { phone: recipientPhone, name: (order.recipient_name || '').trim().split(' ')[0] || 'there' };
  const buyerPhone = normalizePhone(buyer?.phone);
  if (buyerPhone) return { phone: buyerPhone, name: (buyer?.name || '').trim().split(' ')[0] || 'there' };
  return null;
};

export const buildWhatsAppUrl = (phone, message) => `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

/**
 * Cleanly format product / order name.
 * If long (e.g. > 32 chars), truncates neatly so it looks clean on WhatsApp.
 * Handles multiple items cleanly: "Luxury Velvet Box (+2 more)".
 */
export const formatOrderName = (rawNames) => {
  const names = (Array.isArray(rawNames) ? rawNames : [rawNames])
    .map((n) => String(n || '').trim())
    .filter(Boolean);

  if (names.length === 0) return 'Gift Hamper';

  const trimTitle = (title, max = 36) => {
    const t = String(title || '').trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max - 3).trim();
    return `${cut}...`;
  };

  const primary = trimTitle(names[0], 40);

  if (names.length === 1) {
    return primary;
  }
  if (names.length === 2) {
    return `${trimTitle(names[0], 25)} & ${trimTitle(names[1], 25)}`;
  }
  return `${trimTitle(names[0], 28)} (+${names.length - 1} more items)`;
};

/**
 * Resolves order product names cleanly by querying DB or inspecting item payloads
 */
export const resolveOrderProducts = async (order) => {
  const items = (Array.isArray(order?.items) ? order.items : []).filter((i) => i && !i.__delivery_meta);
  if (items.length === 0) return 'Gift Hamper';

  const existingNames = items.map((i) => i.name || i.title || i.product_name).filter(Boolean);
  if (existingNames.length === items.length && existingNames.length > 0) {
    return formatOrderName(existingNames);
  }

  const ids = [...new Set(items.map((i) => i.product_id || i.productId || i.id).filter(Boolean))];
  if (ids.length > 0) {
    try {
      const { data } = await supabase.from('products').select('id, name').in('id', ids);
      const byId = Object.fromEntries((data || []).map((p) => [p.id, p.name]));
      const resolved = items.map((i) => byId[i.product_id || i.productId || i.id] || i.name || 'Gift');
      return formatOrderName(resolved);
    } catch {
      // fallback
    }
  }

  return formatOrderName(existingNames.length > 0 ? existingNames : ['Gift Hamper']);
};

const getProductsSummary = (order, fallbackText) => {
  if (fallbackText) return fallbackText;
  const items = Array.isArray(order?.items) ? order.items.filter((i) => i && !i.__delivery_meta) : [];
  if (items.length === 0) return 'Gift Hamper';
  const names = items.map((i) => i.name || i.title || i.product_name).filter(Boolean);
  return formatOrderName(names);
};

/** All the values a template can use, for one order. */
export const templateValues = ({ order, contactName, productsText }) => {
  const orderName = productsText || getProductsSummary(order);
  return {
    name: contactName,
    order_name: orderName,
    products: orderName,
    order_number: order.order_number || '',
    delivery_date: formatDeliveryDay(order.delivery_date),
    delivery_time: formatDeliveryTime(order.delivery_slot),
    rider_name: order.delivery_partner_name || '',
    rider_phone: order.delivery_partner_phone || '',
    amount: rupees(order.total_amount),
    brand: BRAND,
  };
};

/**
 * Automatically trigger WhatsApp message if auto_send is ON for this event.
 * Safe & resilient: never throws so it cannot block orders or app logic.
 */
export const triggerAutoWhatsApp = async (eventKey, ctx) => {
  try {
    const { order, userId, riderName, riderPhone } = ctx || {};
    if (!order) return null;

    // Map common aliases
    const keyMap = {
      order_placed: 'order_confirmed',
      rider_assigned: 'rider_assigned',
      out_for_delivery: 'out_for_delivery',
      delivered: 'delivered',
      order_cancelled: 'order_cancelled',
    };
    const targetKey = keyMap[eventKey] || eventKey;

    // Check if auto_send is enabled for this template
    const { data: template, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('event_key', targetKey)
      .maybeSingle();

    if (error || !template || !template.is_active || !template.auto_send) {
      return null;
    }

    // Determine recipient
    let buyer = null;
    if (order.buyer_id || userId) {
      const { data } = await supabase
        .from('users')
        .select('name, phone')
        .eq('id', order.buyer_id || userId)
        .maybeSingle();
      buyer = data;
    }

    const contact = pickContact(order, buyer);
    if (!contact || !contact.phone) return null;

    const orderData = {
      ...order,
      delivery_partner_name: riderName || order.delivery_partner_name,
      delivery_partner_phone: riderPhone || order.delivery_partner_phone,
    };

    let productsText = null;
    try {
      productsText = await resolveOrderProducts(order);
    } catch {
      // fallback to internal summary
    }

    const message = renderTemplate(
      template.message,
      templateValues({ order: orderData, contactName: contact.name, productsText })
    );

    // Send via connected bot (with the picture for events that have one)
    // The picture is the template's own (empty = text only). Before migration 023 the built-in pictures are used.
    const picture = 'image_url' in template ? template.image_url : WHATSAPP_IMAGES[targetKey];
    const result = picture
      ? await whatsappBotService.sendImage(contact.phone, whatsappImageUrl(picture), message)
      : await whatsappBotService.sendMessage(contact.phone, message);

    // Log the message in whatsapp_message_log
    const logRow = {
      order_id: order.id,
      event_key: targetKey,
      phone: contact.phone,
      recipient_name: contact.name,
      message,
      admin_id: 'auto_bot',
    };
    await supabase.from('whatsapp_message_log').insert([logRow]);

    return result;
  } catch (err) {
    console.warn(`[AutoWhatsApp] Failed for event ${eventKey}:`, err.message);
    return null;
  }
};
