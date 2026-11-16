import { Router } from 'express';
import { env } from '../src/config/env.js';

const router = Router();

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const handleCopy = (req, res) => {
  const rawCode = String(req.query.code || req.query.c || '').trim();
  const cleanCode = rawCode.replace(/[^a-zA-Z0-9#_-]/g, '').slice(0, 30);
  const type = String(req.query.type || 'otp').toLowerCase();

  // Find suitable frontend URL (prioritize active 9000 Vite dev server)
  const origin =env.allowedOrigins.find((o) => o.includes('9000')) || env.allowedOrigins[0];
  const frontendUrl = (process.env.FRONTEND_URL || origin).replace(/\/+$/, '');

  const redirectUrl =
    type === 'order'
      ? `${frontendUrl}/orders`
      : `${frontendUrl}/auth?code=${encodeURIComponent(cleanCode)}`;

  // Ensure CSP allows the script to run and copy to clipboard
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.removeHeader('Content-Security-Policy');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' 'unsafe-inline' *; script-src 'self' 'unsafe-inline' *; style-src 'self' 'unsafe-inline' *;"
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Copied! - Nyochavar</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #0f172a;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      max-width: 420px;
      width: 100%;
      padding: 36px 28px;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 82, 255, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
    }
    .icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      border-radius: 50%;
      background: #ecfdf5;
      color: #10b981;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: bold;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #0f172a;
    }
    p {
      font-size: 14px;
      color: #64748b;
      line-height: 1.5;
    }
    .code-box {
      margin: 20px 0;
      padding: 14px 24px;
      background: #eff6ff;
      border: 2px dashed #0052FF;
      border-radius: 12px;
      display: inline-block;
      font-family: 'Courier New', Courier, monospace;
      font-size: 30px;
      font-weight: 800;
      letter-spacing: 3px;
      color: #0052FF;
    }
    .status {
      font-size: 13px;
      color: #10b981;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .btn {
      display: inline-block;
      background: #0052FF;
      color: #ffffff;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 14px;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #0040cc;
    }
    .subtext {
      margin-top: 16px;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>Code Copied!</h1>
    <p>The code below has been copied to your clipboard:</p>
    <div class="code-box" id="codeDisplay">${esc(cleanCode)}</div>
    <div class="status" id="statusMsg">✓ Copied to clipboard automatically</div>
    <div>
      <a href="${esc(redirectUrl)}" class="btn" id="openBtn">Open App &amp; Paste →</a>
    </div>
    <p class="subtext" id="redirectMsg">Opening app in 1 second...</p>
  </div>
  <script>
    const code = ${JSON.stringify(cleanCode)};
    const redirectUrl = ${JSON.stringify(redirectUrl)};
    async function doCopy() {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(code);
        } else {
          const ta = document.createElement('textarea');
          ta.value = code;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
      } catch (err) {
        console.warn('Clipboard write error:', err);
      }
      setTimeout(() => {
        if (redirectUrl) {
          window.location.href = redirectUrl;
        }
      }, 1200);
    }
    doCopy();
  </script>
</body>
</html>`;

  res.send(html);
};

router.get('/copy', handleCopy);
router.get('/copy-code', handleCopy);

export default router;
