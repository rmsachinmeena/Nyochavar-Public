import { buildEmailShell, buildHeader, buildBox, buildButton, getFrontendUrl, esc } from './base.js';

const COPY = {
  verify: {
    subject: (otp) => `${otp} is your Nyochavar verification code`,
    title: 'Verify Your Email',
    subtitle: 'Enter this code in the app to verify your email address',
    btnText: 'Open Nyochavar →',
  },
  reset: {
    subject: (otp) => `${otp} is your Nyochavar password reset code`,
    title: 'Reset Your Password',
    subtitle: 'Enter this code in the app to set a new password',
    btnText: 'Reset Password →',
  },
};

const buildOtpBoxes = (otp) => {
  const boxes = String(otp)
    .trim()
    .split('')
    .map(
      (digit) => `
        <td style="padding: 0 6px;">
          <div style="width: 52px; height: 60px; line-height: 60px; border: 2px solid #0052FF; border-radius: 12px; background-color: #ffffff; color: #0f172a; font-family: Arial, sans-serif; font-size: 32px; font-weight: bold; text-align: center; -webkit-user-select: all; user-select: all; cursor: text;">${esc(digit)}</div>
        </td>`
    )
    .join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 28px auto 20px;">
      <tr>${boxes}</tr>
    </table>
  `;
};

/** Returns { subject, html } for a sign-up/login ('verify') or forgot-password ('reset') code. */
export default (otp, purpose = 'verify', email = '') => {
  const copy = COPY[purpose] ?? COPY.verify;
  const subject = copy.subject(otp);

  const queryParams = new URLSearchParams();
  if (purpose === 'reset') {
    queryParams.set('step', 'reset-password');
  } else {
    queryParams.set('step', 'otp');
  }
  if (email) queryParams.set('email', String(email).trim().toLowerCase());
  if (otp) queryParams.set('otp', String(otp).trim());

  const targetUrl = `${getFrontendUrl()}/auth?${queryParams.toString()}`;

  const content = `
    ${buildHeader('🛡️', copy.title, copy.subtitle)}
    ${buildOtpBoxes(otp)}
    ${buildButton(copy.btnText, targetUrl)}
    ${buildBox(`
      <p style="color: #64748b; font-size: 13px; margin: 0 0 6px; text-align: center;">
        This code will expire in <strong>10 minutes</strong>. Never share it with anyone.
      </p>
      <p style="color: #64748b; font-size: 13px; margin: 0; text-align: center;">
        If you didn't request this, you can safely ignore this email.
      </p>
    `)}
  `;

  return { subject, html: buildEmailShell(content, subject, subject) };
};
