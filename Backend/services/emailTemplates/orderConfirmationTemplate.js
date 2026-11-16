import { buildEmailShell, buildHeader, buildButton, buildBox, esc } from './base.js';

const row = (label, value, valueStyle = 'color: #0f172a; font-weight: 600;') => `
  <tr>
    <td style="padding: 4px 0; color: #64748b; font-size: 13px;">${label}</td>
    <td style="padding: 4px 0; text-align: right; font-size: 13px; ${valueStyle}">${value}</td>
  </tr>
`;

export default (orderNumber, customerName, items, total, deliveryDate, trackingUrl) => {
  const subject = `Order #${orderNumber} Confirmed - Nyochavar`;

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <p style="margin: 0; font-weight: 600; color: #0f172a; font-size: 13px;">${esc(item.name)}</p>
          <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Qty: ${esc(item.quantity)}</p>
        </td>
        <td style="padding: 12px 0 12px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #0f172a; white-space: nowrap;">₹${esc(item.price)}</td>
      </tr>
    `
    )
    .join('');

  const content = `
    ${buildHeader('📦', 'Order Confirmed!', `Thank you for your order, ${customerName}`)}
    ${buildBox(`
      <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">Order Number</p>
      <p style="margin: 6px 0 0; color: #0052FF; font-size: 22px; font-weight: bold; font-family: 'Courier New', monospace; text-align: center; -webkit-user-select: all; user-select: all;">#${esc(orderNumber)}</p>
    `)}

    <h3 style="color: #0f172a; font-size: 14px; font-weight: 600; margin: 20px 0 12px;">Order Items</h3>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${itemRows}</table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px;">
      ${row('Delivery', 'FREE', 'color: #10b981; font-weight: 600;')}
      ${row('<strong style="color: #0f172a;">Total</strong>', `₹${esc(total)}`, 'color: #0052FF; font-weight: bold; font-size: 16px;')}
    </table>

    <div style="background-color: #eff6ff; border-left: 4px solid #0052FF; padding: 12px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0 0 4px; color: #0052FF; font-weight: 600; font-size: 13px;">🚚 Delivery Expected</p>
      <p style="margin: 0; color: #0f172a; font-size: 14px; font-weight: 600;">${esc(deliveryDate)}</p>
    </div>

    ${buildButton('Track Order', trackingUrl)}
  `;

  return { subject, html: buildEmailShell(content, subject, `Your order #${orderNumber} is confirmed`) };
};
