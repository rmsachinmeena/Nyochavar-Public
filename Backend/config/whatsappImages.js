// Pictures that go out with the automatic WhatsApp messages (the message text becomes the picture's caption).
// The superadmin sets the picture of each template (whatsapp_templates.image_url); the pictures below are the
// fallback for a database that does not have that column yet (migration 023).
const UPLOAD = 'https://res.cloudinary.com/dodhs4r1l/image/upload';
const SIZED = 'f_jpg,q_auto,w_1000';

/** A Cloudinary picture as WhatsApp wants it: a JPG, 1000px wide (small enough to send quickly). */
export const whatsappImageUrl = (url) => {
  const text = String(url || '');
  if (!text.includes('/image/upload/') || text.includes('/f_jpg')) return text;
  return text.replace('/image/upload/', `/image/upload/${SIZED}/`);
};

export const WHATSAPP_IMAGES = {
  order_confirmed: `${UPLOAD}/v1793388880/WHATSAPP_IMAGES/order_confirmed.png`,
  rider_assigned: `${UPLOAD}/v1793389875/WHATSAPP_IMAGES/rider_assigned.png`,
  out_for_delivery: `${UPLOAD}/v1793389873/WHATSAPP_IMAGES/out_for_delivery.png`,
  delivered: `${UPLOAD}/v1793389876/WHATSAPP_IMAGES/delivered.png`,
  order_cancelled: `${UPLOAD}/v1793389877/WHATSAPP_IMAGES/order_cancelled.png`,
  verify_otp: `${UPLOAD}/v1793389878/WHATSAPP_IMAGES/verify_otp.png`,
};
