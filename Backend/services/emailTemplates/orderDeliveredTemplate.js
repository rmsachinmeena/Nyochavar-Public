import { buildEmailShell, buildHeader, buildButton, buildBox, esc } from './base.js';

export default (orderNumber, recipientName, deliveryTime, reviewUrl) => {
  const subject = `Order #${orderNumber} Delivered - Nyochavar`;

  const content = `
    ${buildHeader('✅', 'Order Delivered!', `Your gift has been delivered to ${recipientName}`)}
    ${buildBox(`
      <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">Order Number</p>
      <p style="margin: 6px 0 0; color: #0052FF; font-size: 22px; font-weight: bold; font-family: 'Courier New', monospace; text-align: center; -webkit-user-select: all; user-select: all;">#${esc(orderNumber)}</p>
      <p style="margin: 16px 0 6px; color: #64748b; font-size: 12px; text-align: center;">Delivered at</p>
      <p style="margin: 0; color: #10b981; font-weight: 600; font-size: 16px; text-align: center;">${esc(deliveryTime)}</p>
    `)}

    <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 12px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0; color: #047857; font-size: 13px;">
        ✨ Your order has been successfully delivered. We hope your gift brought a smile!
      </p>
    </div>

    ${buildButton('Share Feedback', reviewUrl)}

    ${buildBox(`
      <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.6;">
        Have questions? Our support team is here to help. Reply to this email or visit our website.
      </p>
    `)}
  `;

  return { subject, html: buildEmailShell(content, subject, subject) };
};
