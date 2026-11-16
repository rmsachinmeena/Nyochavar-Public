import { request } from './apiClient';

export interface WhatsappTemplate {
  event_key: string;
  name: string;
  message: string;
  is_active: boolean;
  auto_send?: boolean;
  /** The picture that goes out with the message (empty = text only) */
  image_url?: string | null;
  updated_at?: string;
}

/** A picture uploaded for WhatsApp messages */
export interface WhatsappPicture {
  url: string;
  width: number;
  height: number;
  bytes: number;
}

/** The words a template may use, shown as hints in the editor (the server refuses any other). */
export const WHATSAPP_PLACEHOLDERS = [
  '{{name}}',
  '{{order_name}}',
  '{{order_number}}',
  '{{products}}',
  '{{amount}}',
  '{{delivery_date}}',
  '{{delivery_time}}',
  '{{rider_name}}',
  '{{rider_phone}}',
  '{{brand}}',
];

/** The verification-code message: its code word {{otp}} has to stay in the text, and it is always sent. */
export const OTP_TEMPLATE_KEY = 'verify_otp';
export const OTP_PLACEHOLDERS = ['{{otp}}', '{{minutes}}', '{{brand}}'];

/** The templates that come with the shop: they cannot be deleted. */
export const BUILT_IN_WHATSAPP_TEMPLATES = ['order_confirmed', 'out_for_delivery', OTP_TEMPLATE_KEY];

/** A Cloudinary picture at a smaller size, for previews in the admin. */
export const whatsappPictureSrc = (url: string, width = 600): string =>
  url.includes('/image/upload/') && !url.includes('/f_auto')
    ? url.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${width}/`)
    : url;

export interface WhatsappLogEntry {
  id: string;
  created_at: string;
  order_id: string;
  order_number: string | null;
  template: string;
  phone: string | null;
  recipient_name: string | null;
  message: string | null;
  admin_name: string | null;
}

/** "Click to send" WhatsApp messages: the superadmin only presses Send inside WhatsApp. */
export const whatsappService = {
  listTemplates: async (): Promise<WhatsappTemplate[]> =>
    (await request('/admin/whatsapp/templates', { role: 'superadmin', fallbackMessage: 'Could not load the WhatsApp templates' })).templates,

  updateTemplate: async (
    eventKey: string,
    patch: Partial<Pick<WhatsappTemplate, 'name' | 'message' | 'is_active' | 'auto_send' | 'image_url'>>
  ): Promise<WhatsappTemplate> =>
    (
      await request(`/admin/whatsapp/templates/${encodeURIComponent(eventKey)}`, {
        method: 'PUT',
        role: 'superadmin',
        body: patch,
        fallbackMessage: 'Could not save the WhatsApp template',
      })
    ).template,

  createTemplate: async (input: { name: string; message: string; auto_send?: boolean; image_url?: string | null }): Promise<WhatsappTemplate> =>
    (await request('/admin/whatsapp/templates', { method: 'POST', role: 'superadmin', body: input, fallbackMessage: 'Could not add the template' })).template,

  deleteTemplate: async (eventKey: string): Promise<void> => {
    await request(`/admin/whatsapp/templates/${encodeURIComponent(eventKey)}`, { method: 'DELETE', role: 'superadmin', fallbackMessage: 'Could not delete the template' });
  },

  /** Uploads a picture for a template to Cloudinary (JPG, PNG or WebP, up to 5 MB). */
  uploadImage: async (file: File): Promise<WhatsappPicture> => {
    const formData = new FormData();
    formData.append('image', file);
    const data = await request('/admin/whatsapp/images', {
      method: 'POST',
      role: 'superadmin',
      body: formData,
      timeoutMs: 60_000,
      fallbackMessage: 'Could not upload the picture',
    });
    return data.image;
  },

  /** The pictures uploaded so far, newest first. */
  listImages: async (): Promise<WhatsappPicture[]> =>
    (await request('/admin/whatsapp/images', { role: 'superadmin', fallbackMessage: 'Could not load the uploaded pictures' })).images,

  /** The messages that were prepared for orders, newest first. */
  listLog: async (): Promise<WhatsappLogEntry[]> =>
    (await request('/admin/whatsapp/log', { role: 'superadmin', fallbackMessage: 'Could not load the message list' })).log,

  /** The wa.me link (number and message already filled) for one order and one template. */
  createLink: async (orderId: string, eventKey: string): Promise<{ url: string; phone: string; message: string }> =>
    request('/admin/whatsapp/link', {
      method: 'POST',
      role: 'superadmin',
      body: { order_id: orderId, event_key: eventKey },
      fallbackMessage: 'Could not prepare the WhatsApp message',
    }),

  /** WhatsApp Automated Bot status (connection, QR code data URL, linked phone) */
  getBotStatus: async (): Promise<{ success: boolean; status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected'; qrCode: string | null; phone: string | null; error: string | null }> =>
    request('/admin/whatsapp/bot/status', {
      role: 'superadmin',
      fallbackMessage: 'Could not fetch WhatsApp bot status',
    }),

  /** Connect WhatsApp Bot and generate QR code for scanning */
  connectBot: async (): Promise<{ success: boolean; status: string; qrCode: string | null; phone: string | null }> =>
    request('/admin/whatsapp/bot/connect', {
      method: 'POST',
      role: 'superadmin',
      fallbackMessage: 'Could not connect WhatsApp bot',
    }),

  /** Request 8-digit Pairing Code for direct phone linking (no camera needed) */
  getPairingCode: async (phone: string): Promise<{ success: boolean; pairingCode: string; phone: string }> =>
    request('/admin/whatsapp/bot/pairing-code', {
      method: 'POST',
      role: 'superadmin',
      body: { phone },
      fallbackMessage: 'Could not generate pairing code',
    }),

  /** Disconnect WhatsApp Bot and clear session */
  disconnectBot: async (): Promise<{ success: boolean; message: string }> =>
    request('/admin/whatsapp/bot/disconnect', {
      method: 'POST',
      role: 'superadmin',
      fallbackMessage: 'Could not disconnect WhatsApp bot',
    }),

  /** Get system verification settings (active provider, whatsapp/firebase toggles) */
  getVerificationSettings: async (): Promise<{
    id: string;
    active_provider: 'whatsapp' | 'firebase' | 'both' | 'disabled';
    whatsapp_enabled: boolean;
    firebase_enabled: boolean;
    otp_expiry_minutes: number;
    max_attempts: number;
  }> =>
    (
      await request('/admin/whatsapp/verification-settings', {
        role: 'superadmin',
        fallbackMessage: 'Could not load verification settings',
      })
    ).settings,

  /** Update verification settings from superadmin */
  updateVerificationSettings: async (settings: {
    active_provider?: 'whatsapp' | 'firebase' | 'both' | 'disabled';
    whatsapp_enabled?: boolean;
    firebase_enabled?: boolean;
    otp_expiry_minutes?: number;
    max_attempts?: number;
  }): Promise<any> =>
    (
      await request('/admin/whatsapp/verification-settings', {
        method: 'PUT',
        role: 'superadmin',
        body: settings,
        fallbackMessage: 'Could not update verification settings',
      })
    ).settings,
};
