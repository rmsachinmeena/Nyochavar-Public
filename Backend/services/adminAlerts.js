import { emailService } from './emailService.js';
import { whatsappBotService } from './whatsappBotService.js';
import { buildEmailShell, esc, getFrontendUrl } from './emailTemplates/base.js';

// Alerts for the store team (not customers). Who receives them is set on the server, as comma-separated lists:
//   ADMIN_ALERT_EMAILS=owner@gmail.com, partner@gmail.com
//   ADMIN_ALERT_PHONES=9876543210, 9876543211
// WhatsApp goes out only while the store's WhatsApp bot is connected (Superadmin > WhatsApp); email needs an email
// provider (Resend or SMTP). The admin Orders page ("Refund due") is the reliable list: these alerts are reminders.

const list = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

export const alertRecipients = () => ({
  emails: list(process.env.ADMIN_ALERT_EMAILS).filter((email) => email.includes('@')),
  phones: list(process.env.ADMIN_ALERT_PHONES)
});

/**
 * Sends one alert to every admin on the lists. Never throws: an alert must not break a cancellation or a payment.
 * @param {{ subject: string, lines: string[], link?: string }} alert  plain lines, used for both WhatsApp and email
 */
export const alertAdmins = async ({ subject, lines, link }) => {
  const { emails, phones } = alertRecipients();
  if (emails.length === 0 && phones.length === 0) {
    console.warn(`[AdminAlert] No ADMIN_ALERT_EMAILS / ADMIN_ALERT_PHONES set: "${subject}" was not sent`);
    return;
  }

  const text = [`*${subject}*`, '', ...lines, ...(link ? ['', link] : [])].join('\n');
  const html = buildEmailShell(
    `<h1 style="font-size: 20px; margin: 0 0 16px; color: #0F172A;">${esc(subject)}</h1>
     ${lines.map((line) => `<p style="margin: 6px 0; font-size: 14px; color: #0F172A;">${esc(line)}</p>`).join('')}
     ${link ? `<p style="margin: 20px 0 0; font-size: 14px;"><a href="${esc(link)}" style="color: #0052FF;">Open in admin</a></p>` : ''}`,
    subject,
    lines[0] || ''
  );

  const sends = [
    ...emails.map((email) => emailService.sendMessage(email, subject, html)),
    ...phones.map((phone) => whatsappBotService.sendMessage(phone, text))
  ];
  const results = await Promise.allSettled(sends);
  const failed = results.filter((r) => r.status === 'rejected' || r.value === false || r.value?.success === false).length;
  if (failed > 0) console.warn(`[AdminAlert] "${subject}": ${failed} of ${results.length} alerts could not be sent`);
};

/** "Refund needed" alert for a paid online order that has been cancelled. */
export const alertRefundDue = (order, reason) => {
  const amount = `₹${Number(order.refund_amount ?? order.total_amount).toLocaleString('en-IN')}`;
  const paymentId = String(order.payment_ref || '').split(':')[2] || 'not found';
  return alertAdmins({
    subject: `Refund needed: ${amount} for order ${order.order_number || order.id}`,
    lines: [
      `Reason: ${reason}`,
      `Recipient: ${order.recipient_name || 'unknown'}${order.recipient_phone ? `, ${order.recipient_phone}` : ''}`,
      `Razorpay payment: ${paymentId}`,
      'Refund it from the Razorpay dashboard (Transactions > Payments > search the payment > Issue refund). The order is marked refunded automatically.'
    ],
    link: `${getFrontendUrl()}/admin/orders`
  });
};
