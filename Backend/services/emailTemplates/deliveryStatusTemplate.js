import { buildEmailShell, buildHeader, buildButton, buildBox, esc } from './base.js';

const STATUS = {
  assigned: { icon: '🚚', title: 'Rider Assigned', color: '#3b82f6' },
  on_the_way: { icon: '🚗', title: 'On The Way', color: '#8b5cf6' },
  arriving_soon: { icon: '📍', title: 'Arriving Soon', color: '#f59e0b' },
  delivered: { icon: '✅', title: 'Delivered', color: '#10b981' },
};

export default (orderNumber, status, riderName, riderPhone, eta, trackingUrl) => {
  const info = STATUS[status] ?? { icon: '📦', title: 'Update', color: '#0052FF' };
  const subject = `${info.title} - Order #${orderNumber}`;

  const riderInfo = riderName
    ? buildBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <p style="margin: 0 0 4px; color: #64748b; font-size: 12px;">Delivery Partner</p>
            <p style="margin: 0; color: #0f172a; font-weight: 600;">${esc(riderName)}</p>
          </td>
          ${
            riderPhone
              ? `<td style="text-align: right;">
                  <a href="tel:${esc(riderPhone)}" style="background-color: ${info.color}; color: #ffffff; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600;">Call</a>
                </td>`
              : ''
          }
        </tr>
      </table>
    `)
    : '';

  const etaInfo = eta
    ? buildBox(`
      <p style="margin: 0 0 4px; color: #64748b; font-size: 12px;">Expected Arrival</p>
      <p style="margin: 0; color: #0f172a; font-weight: 600; font-size: 14px;">${esc(eta)}</p>
    `)
    : '';

  const content = `
    ${buildHeader(info.icon, info.title, `Order #${orderNumber}`)}
    ${buildBox(`
      <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">Order Number</p>
      <p style="margin: 6px 0 0; color: ${info.color}; font-size: 22px; font-weight: bold; font-family: 'Courier New', monospace; text-align: center; -webkit-user-select: all; user-select: all;">#${esc(orderNumber)}</p>
    `)}
    ${riderInfo}
    ${etaInfo}
    ${buildButton('Track Live', trackingUrl)}
  `;

  return { subject, html: buildEmailShell(content, subject, subject) };
};
