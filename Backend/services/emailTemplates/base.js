// Inline styles only: many mail clients strip <style> blocks and ignore flexbox.

export const COLORS = {
  primary: '#0052FF',
  white: '#FFFFFF',
  text: '#0F172A',
  textLight: '#64748B',
  border: '#E2E8F0',
  success: '#10B981',
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

export const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const buildEmailShell = (content, subject, preheader = '') => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <title>${esc(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: ${FONT};">
  <div style="display: none; max-height: 0; overflow: hidden;">${esc(preheader)}</div>
  <div style="background-color: #f1f5f9; padding: 24px 12px;">
    <div style="max-width: 480px; margin: 0 auto; background-color: ${COLORS.white}; border: 1px solid ${COLORS.border}; border-radius: 16px; padding: 28px 24px; font-family: ${FONT};">
      ${content}
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid ${COLORS.border}; text-align: center; font-size: 12px; color: ${COLORS.textLight};">
        <p style="margin: 8px 0;">Nyochavar Concierge</p>
        <p style="margin: 4px 0; font-size: 11px;">Same-day flower delivery &amp; artisanal hampers</p>
      </div>
    </div>
  </div>
</body>
</html>`;

export const buildHeader = (icon, title, subtitle) => `
  <div style="text-align: center; margin-bottom: 28px;">
    <div style="width: 60px; height: 60px; line-height: 60px; margin: 0 auto 16px; border-radius: 50%; background-color: ${COLORS.primary}; color: ${COLORS.white}; font-size: 30px; text-align: center;">${icon}</div>
    <h1 style="color: ${COLORS.text}; font-size: 24px; font-weight: bold; margin: 0 0 8px; font-family: Georgia, serif;">${esc(title)}</h1>
    <p style="color: ${COLORS.textLight}; font-size: 14px; margin: 0; line-height: 1.5;">${esc(subtitle)}</p>
  </div>
`;

export const buildButton = (text, url) => `
  <div style="text-align: center; margin: 24px 0;">
    <a href="${esc(url)}" style="display: inline-block; background-color: ${COLORS.primary}; color: ${COLORS.white}; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">${esc(text)}</a>
  </div>
`;

export const buildBox = (content, bgColor = '#f8fafc') => `
  <div style="background-color: ${bgColor}; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid ${COLORS.border};">
    ${content}
  </div>
`;

export const getFrontendUrl = () => {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/+$/, '');
  if (process.env.FRONTEND_ORIGIN) {
    const firstOrigin = process.env.FRONTEND_ORIGIN.split(',')[0].trim().replace(/\/+$/, '');
    if (firstOrigin) return firstOrigin;
  }
  if (process.env.NODE_ENV === 'production') return 'https://gift-idea.onrender.com';
  return 'http://localhost:9000';
};

// Clean non-dashed, selectable plain code display (no extra buttons or links)
export const buildCopyableCode = (value) => `
  <div style="text-align: center; margin: 6px 0 10px;">
    <span style="display: inline-block; color: ${COLORS.primary}; font-family: 'Courier New', Courier, monospace; font-size: 22px; font-weight: bold; letter-spacing: 2px; -webkit-user-select: all; user-select: all;">${esc(value)}</span>
  </div>
`;
