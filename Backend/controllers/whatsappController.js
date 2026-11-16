import { v2 as cloudinary } from 'cloudinary';
import { supabase } from '../config/supabase.js';
import { uploadToCloudinary } from '../services/cloudinaryService.js';
import { orderModel } from '../models/orderModel.js';
import { auditLogger } from '../services/auditLogger.js';
import { loadProducts } from '../services/notificationService.js';
import { buildWhatsAppUrl, pickContact, renderTemplate, templateValues } from '../services/whatsappService.js';
import { whatsappBotService } from '../services/whatsappBotService.js';
import { phoneVerificationService } from '../services/phoneVerificationService.js';

// The two templates that come with the shop: they can be edited and switched off, but not deleted
const BUILT_IN = ['order_confirmed', 'out_for_delivery', 'verify_otp'];

// The verification-code message: it can use only these words, and it has to contain {{otp}}
const OTP_TEMPLATE = 'verify_otp';
const OTP_WORDS = ['otp', 'minutes', 'brand'];

// Returns what is wrong with a message for this template, or null. The code words stay inside the OTP template,
// so a delivery OTP (or any other code) can never be put into an order message.
const messageProblem = (eventKey, message) => {
  const used = [...String(message).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]);
  if (eventKey === OTP_TEMPLATE) {
    if (!used.includes('otp')) return 'The OTP message must contain {{otp}}, or the code will not reach the customer.';
    if (used.some((word) => !OTP_WORDS.includes(word))) return 'The OTP message can only use {{otp}}, {{minutes}} and {{brand}}.';
    return null;
  }
  if (used.includes('otp') || used.includes('minutes')) return '{{otp}} and {{minutes}} can only be used in the Verify OTP template.';
  return null;
};

// Pictures for templates are uploaded to this Cloudinary folder
const IMAGE_FOLDER = 'WHATSAPP_IMAGES';
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const missingColumn = (error) => /image_url/.test(error?.message || '') && /column|schema cache/i.test(error?.message || '');
const MIGRATION_HINT = 'Run migration 023_whatsapp_template_images.sql in Supabase first.';

// "Out for delivery" -> "out_for_delivery"
const slugify = (name) =>
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

// A template that talks about the delivery partner needs one to be assigned
const needsRider = (text) => /\{\{\s*rider_(name|phone)\s*\}\}/.test(String(text));

// The same message for the same order is not prepared again within 4 hours
const COOLDOWN_MS = 4 * 60 * 60 * 1000;

const fail = (res, error, fallback) => {
  console.error(fallback, error);
  res.status(500).json({ success: false, message: error?.message || fallback });
};

const waitText = (ms) => {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  return minutes >= 60 ? `${Math.ceil(minutes / 60)} hour(s)` : `${minutes} minute(s)`;
};

export const whatsappController = {
  listTemplates: async (req, res) => {
    try {
      const { data, error } = await supabase.from('whatsapp_templates').select('*').order('event_key');
      if (error) throw new Error(error.message);
      res.status(200).json({ success: true, templates: data || [] });
    } catch (error) {
      fail(res, error, 'Failed to load the WhatsApp templates');
    }
  },

  // A new template (for example "Delivered" or "Delivery rescheduled"); its key is made from the name
  createTemplate: async (req, res) => {
    try {
      const { name, message, auto_send, image_url } = req.body;
      const eventKey = slugify(name);
      if (!eventKey) return res.status(400).json({ success: false, message: 'Use letters or numbers in the template name.' });
      if (eventKey === OTP_TEMPLATE) return res.status(409).json({ success: false, message: 'A template with this name already exists.' });
      const problem = messageProblem(eventKey, message);
      if (problem) return res.status(400).json({ success: false, message: problem });

      const { data: existing } = await supabase.from('whatsapp_templates').select('event_key').eq('event_key', eventKey).maybeSingle();
      if (existing) return res.status(409).json({ success: false, message: 'A template with this name already exists.' });

      const { data, error } = await supabase.from('whatsapp_templates').insert([{ event_key: eventKey, name, message, auto_send: auto_send === true, ...(image_url ? { image_url } : {}) }]).select().single();
      if (error) throw new Error(missingColumn(error) ? MIGRATION_HINT : error.message);
      await auditLogger.log({ action: 'WHATSAPP_TEMPLATE_CREATED', table_affected: 'whatsapp_templates', record_id: eventKey });
      res.status(201).json({ success: true, template: data });
    } catch (error) {
      fail(res, error, 'Failed to create the WhatsApp template');
    }
  },

  // The pictures uploaded for templates so far, newest first (so one picture can be used by several templates)
  listImages: async (req, res) => {
    try {
      const result = await cloudinary.search.expression(`folder:${IMAGE_FOLDER}`).sort_by('created_at', 'desc').max_results(60).execute();
      const images = (result.resources || []).map((item) => ({
        url: item.secure_url,
        width: item.width,
        height: item.height,
        bytes: item.bytes,
        created_at: item.created_at,
      }));
      res.status(200).json({ success: true, images });
    } catch (error) {
      fail(res, error, 'Failed to load the uploaded pictures');
    }
  },

  // Uploads one picture for a template to Cloudinary (JPG, PNG or WebP, up to 5 MB)
  uploadImage: async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ success: false, message: 'Choose a picture to upload.' });
      if (!IMAGE_TYPES.includes(file.mimetype)) {
        return res.status(400).json({ success: false, message: 'Only JPG, PNG or WebP pictures can be used.' });
      }
      if (file.size > IMAGE_MAX_BYTES) {
        return res.status(400).json({ success: false, message: 'The picture is larger than 5 MB. Please upload a smaller one.' });
      }

      const baseName = String(req.body?.name || file.originalname.split('.')[0] || 'whatsapp').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      const result = await uploadToCloudinary(file.buffer, { folder: IMAGE_FOLDER, public_id: `${baseName}_${Date.now()}` });
      await auditLogger.log({ action: 'WHATSAPP_IMAGE_UPLOADED', table_affected: 'whatsapp_templates', record_id: result.public_id });
      res.status(200).json({ success: true, image: { url: result.secure_url, width: result.width, height: result.height, bytes: result.bytes } });
    } catch (error) {
      fail(res, error, 'Failed to upload the picture');
    }
  },

  deleteTemplate: async (req, res) => {
    try {
      const { eventKey } = req.params;
      if (BUILT_IN.includes(eventKey)) {
        return res.status(409).json({ success: false, message: 'This template comes with the shop. You can switch it off, but not delete it.' });
      }
      const { data, error } = await supabase.from('whatsapp_templates').delete().eq('event_key', eventKey).select('event_key');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return res.status(404).json({ success: false, message: 'Template not found' });
      await auditLogger.log({ action: 'WHATSAPP_TEMPLATE_DELETED', table_affected: 'whatsapp_templates', record_id: eventKey });
      res.status(200).json({ success: true });
    } catch (error) {
      fail(res, error, 'Failed to delete the WhatsApp template');
    }
  },

  // The messages that were prepared for orders, newest first (with the template, order, customer and admin names)
  listLog: async (req, res) => {
    try {
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
      const { data: rows, error } = await supabase.from('whatsapp_message_log').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw new Error(error.message);
      const log = rows || [];

      const orderIds = [...new Set(log.map((row) => row.order_id))];
      const adminIds = [...new Set(log.map((row) => row.admin_id).filter(Boolean))];
      const [{ data: templates }, { data: orders }, { data: admins }] = await Promise.all([
        supabase.from('whatsapp_templates').select('event_key, name'),
        orderIds.length ? supabase.from('orders').select('id, order_number, recipient_name').in('id', orderIds) : { data: [] },
        adminIds.length ? supabase.from('admins').select('id, name').in('id', adminIds) : { data: [] },
      ]);
      const templateName = Object.fromEntries((templates || []).map((t) => [t.event_key, t.name]));
      const orderById = Object.fromEntries((orders || []).map((o) => [o.id, o]));
      const adminName = Object.fromEntries((admins || []).map((a) => [a.id, a.name]));

      res.status(200).json({
        success: true,
        log: log.map((row) => ({
          id: row.id,
          created_at: row.created_at,
          order_id: row.order_id,
          order_number: orderById[row.order_id]?.order_number || null,
          template: templateName[row.event_key] || row.event_key,
          phone: row.phone,
          recipient_name: row.recipient_name || orderById[row.order_id]?.recipient_name || null,
          message: row.message || null,
          admin_name: adminName[row.admin_id] || null,
        })),
      });
    } catch (error) {
      fail(res, error, 'Failed to load the WhatsApp message list');
    }
  },

  updateTemplate: async (req, res) => {
    try {
      const { eventKey } = req.params;
      const changes = { ...req.body };
      if (changes.message !== undefined) {
        const problem = messageProblem(eventKey, changes.message);
        if (problem) return res.status(400).json({ success: false, message: problem });
      }
      // The verification code must always go out: this template cannot be switched off
      if (eventKey === OTP_TEMPLATE) {
        delete changes.is_active;
        delete changes.auto_send;
      }
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('event_key', eventKey)
        .select()
        .maybeSingle();
      if (error) throw new Error(missingColumn(error) ? MIGRATION_HINT : error.message);
      if (!data) return res.status(404).json({ success: false, message: 'Template not found' });
      await auditLogger.log({ action: 'WHATSAPP_TEMPLATE_UPDATED', table_affected: 'whatsapp_templates', record_id: eventKey });
      res.status(200).json({ success: true, template: data });
    } catch (error) {
      fail(res, error, 'Failed to update the WhatsApp template');
    }
  },

  // Builds the wa.me link for one order and one template. The admin opens it and presses Send in WhatsApp.
  createLink: async (req, res) => {
    try {
      const { order_id: orderId, event_key: eventKey } = req.body;
      if (eventKey === OTP_TEMPLATE) {
        return res.status(404).json({ success: false, message: 'This WhatsApp template is not available.' });
      }

      const order = await orderModel.findById(orderId);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
      if (order.order_status === 'cancelled') {
        return res.status(409).json({ success: false, message: 'This order is cancelled, so no WhatsApp message is needed.' });
      }

      const { data: template, error: templateError } = await supabase.from('whatsapp_templates').select('*').eq('event_key', eventKey).maybeSingle();
      if (templateError) throw new Error(templateError.message);
      if (!template || template.is_active === false) {
        return res.status(404).json({ success: false, message: 'This WhatsApp template is not available.' });
      }

      if (needsRider(template.message) && !order.delivery_partner_name) {
        return res.status(409).json({ success: false, message: 'Assign a delivery partner to this order first.' });
      }

      const { data: buyer } = await supabase.from('users').select('name, phone').eq('id', order.buyer_id).maybeSingle();
      const contact = pickContact(order, buyer);
      if (!contact) {
        return res.status(422).json({ success: false, message: 'This order has no valid phone number (recipient or buyer).' });
      }

      // Not twice within 4 hours
      const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
      const { data: last } = await supabase
        .from('whatsapp_message_log')
        .select('created_at')
        .eq('order_id', order.id)
        .eq('event_key', eventKey)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last) {
        const left = COOLDOWN_MS - (Date.now() - new Date(last.created_at).getTime());
        return res.status(429).json({
          success: false,
          code: 'WHATSAPP_COOLDOWN',
          message: `This message was already prepared for this order. You can send it again in ${waitText(left)}.`,
        });
      }

      const products = await loadProducts(order);
      const message = renderTemplate(template.message, templateValues({ order, contactName: contact.name, productsText: products.text }));

      const logRow = { order_id: order.id, event_key: eventKey, phone: contact.phone, admin_id: req.auth?.id || null };
      const { error: logError } = await supabase.from('whatsapp_message_log').insert([{ ...logRow, message, recipient_name: contact.name }]);
      if (logError) await supabase.from('whatsapp_message_log').insert([logRow]); // migration 020 not run yet
      await auditLogger.log({ action: 'WHATSAPP_MESSAGE_PREPARED', table_affected: 'orders', record_id: order.id });

      res.status(200).json({ success: true, url: buildWhatsAppUrl(contact.phone, message), phone: contact.phone, message });
    } catch (error) {
      fail(res, error, 'Failed to prepare the WhatsApp message');
    }
  },

  // WhatsApp Automated Bot: get connection status & QR code
  getBotStatus: async (req, res) => {
    try {
      const status = whatsappBotService.getStatus();
      res.status(200).json({ success: true, ...status });
    } catch (error) {
      fail(res, error, 'Failed to get WhatsApp bot status');
    }
  },

  // WhatsApp Automated Bot: connect and generate QR code
  connectBot: async (req, res) => {
    try {
      const status = await whatsappBotService.initialize();
      res.status(200).json({ success: true, ...status });
    } catch (error) {
      fail(res, error, 'Failed to start WhatsApp bot connection');
    }
  },

  // WhatsApp Automated Bot: disconnect and clear session
  disconnectBot: async (req, res) => {
    try {
      const result = await whatsappBotService.disconnect();
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      fail(res, error, 'Failed to disconnect WhatsApp bot');
    }
  },

  // WhatsApp Automated Bot: get 8-digit pairing code for direct phone linking
  getPairingCode: async (req, res) => {
    try {
      const { phone } = req.body;
      const result = await whatsappBotService.requestPairingCode(phone);
      res.status(200).json(result);
    } catch (error) {
      fail(res, error, error?.message || 'Failed to generate pairing code');
    }
  },

  // Verification Settings: get current active provider (whatsapp, firebase, etc.)
  getVerificationSettings: async (req, res) => {
    try {
      const settings = await phoneVerificationService.getSettings(true);
      res.status(200).json({ success: true, settings });
    } catch (error) {
      fail(res, error, 'Failed to load verification settings');
    }
  },

  // Verification Settings: update active provider and toggles
  updateVerificationSettings: async (req, res) => {
    try {
      const updated = await phoneVerificationService.updateSettings(req.body);
      await auditLogger.log({
        action: 'VERIFICATION_SETTINGS_UPDATED',
        table_affected: 'verification_settings',
        record_id: 'global',
      });
      res.status(200).json({ success: true, settings: updated });
    } catch (error) {
      fail(res, error, 'Failed to update verification settings');
    }
  },
};
