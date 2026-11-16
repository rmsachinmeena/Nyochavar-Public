// Public contact details, read from env so no real number lives in the code.
// Set VITE_CONCIERGE_WHATSAPP to digits only with country code, e.g. 919999999999.
export const CONCIERGE_WHATSAPP: string = import.meta.env.VITE_CONCIERGE_WHATSAPP || '919999999999';

export const CONCIERGE_DISPLAY: string = import.meta.env.VITE_CONCIERGE_DISPLAY || '+91 99999 99999';

export const conciergeWhatsAppLink = (message: string): string =>
  `https://wa.me/${CONCIERGE_WHATSAPP}?text=${encodeURIComponent(message)}`;
