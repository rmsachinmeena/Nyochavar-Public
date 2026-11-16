import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { otpEmail } from './emailTemplates/index.js';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const isPlaceholder = (value) => !value || value.includes('your_');

const hasResend = !!process.env.RESEND_API_KEY;
const hasSmtp = !isPlaceholder(process.env.SMTP_USER) && !isPlaceholder(process.env.SMTP_PASS);

// Hosting dashboards keep quotes pasted around a value; a Gmail app password is shown with spaces but works without them
const cleanEnv = (value) => String(value ?? '').trim().replace(/^["']|["']$/g, '');
const smtpUser = cleanEnv(process.env.SMTP_USER);
const smtpPass = cleanEnv(process.env.SMTP_PASS).replace(/\s+/g, '');
const smtpPort = parseInt(cleanEnv(process.env.SMTP_PORT)) || 587;

// SMTP transport (fine locally; note Render's free tier blocks outbound SMTP ports, use RESEND_API_KEY there)
const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: cleanEnv(process.env.SMTP_HOST) || 'smtp.gmail.com',
      port: smtpPort,
      secure: smtpPort === 465, // port 465 is TLS from the start; 587 upgrades with STARTTLS
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    })
  : null;

const FROM_ADDRESS = process.env.EMAIL_FROM || (hasSmtp ? `"Nyochavar Concierge" <${smtpUser}>` : 'Nyochavar <onboarding@resend.dev>');

// HTTPS email API: works on hosts that block SMTP (Render free tier)
const sendViaResend = async (to, subject, html) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend responded ${response.status}: ${detail.slice(0, 200)}`);
  }
};

// Mail server link: a host that blocks SMTP (Render) builds the whole message here and hands it to another deployment of
// this backend (Vercel) that can use SMTP. EMAIL_API_URL is that server's link (the base link is enough) and EMAIL_API_KEY
// the secret both sides share. Leave both empty on the mail server itself and on a machine that can use SMTP directly.
const emailApiUrl = (process.env.EMAIL_API_URL || '').trim();
const emailApiKey = (process.env.EMAIL_API_KEY || '').trim();
const useMailServer = Boolean(emailApiUrl && emailApiKey);
const MAIL_SERVER_PATH = '/api/internal/send-email';
const mailServerEndpoint = emailApiUrl.includes(MAIL_SERVER_PATH) ? emailApiUrl : `${emailApiUrl.replace(/\/+$/, '')}${MAIL_SERVER_PATH}`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** type: 'otp-verify' | 'otp-reset' | 'message'. One retry for a network failure, a busy server or a 5xx. */
const sendViaMailServer = async (type, to, subject, html) => {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(mailServerEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': emailApiKey },
        body: JSON.stringify({ type, to, subject, html }),
        signal: AbortSignal.timeout(14_000),
      });
      if (response.ok) return;
      const detail = await response.text().catch(() => '');
      lastError = new Error(`Mail server responded ${response.status}: ${detail.slice(0, 160)}`);
      // A wrong key or a refused message will not get better by trying again
      if (response.status < 500 && response.status !== 429) throw lastError;
    } catch (error) {
      if (error === lastError) throw error;
      lastError = error;
    }
    if (attempt < 2) await wait(900);
  }
  throw lastError;
};

// Development only: print the code instead of emailing it. The code must never reach production logs.
const logOtpForDev = (email, otp, reason) => {
  console.log(`\n=================================================`);
  console.log(`[Nyochavar DEV AUTH] ${reason}`);
  console.log(`Email intended for: ${email}`);
  console.log(`Your OTP is: >>> ${otp} <<<`);
  console.log(`=================================================\n`);
};

export const emailService = {
  /** A plain message email (admin broadcasts). Returns true when sent; never throws. */
  sendMessage: async (to, subject, html) => {
    try {
      if (useMailServer) {
        await sendViaMailServer('message', to, subject, html);
        return true;
      }
      if (hasResend) {
        await sendViaResend(to, subject, html);
        return true;
      }
      if (transporter) {
        await transporter.sendMail({ from: FROM_ADDRESS, to, subject, html });
        return true;
      }
      console.warn('[Email] No provider configured: message email skipped');
      return false;
    } catch (error) {
      console.error(`[Email] Message delivery failed: ${error.message}`);
      return false;
    }
  },

  /** Sends a finished message with this server's own provider (Resend or SMTP). Throws when it cannot. Used by the mail server route. */
  sendDirect: async (to, subject, html) => {
    if (hasResend) return sendViaResend(to, subject, html);
    if (transporter) {
      await transporter.sendMail({ from: FROM_ADDRESS, to, subject, html });
      return;
    }
    throw new Error('No email provider (SMTP or Resend) is configured on this server');
  },

  /** purpose: 'verify' (sign-up / login) or 'reset' (forgot password) */
  sendOTP: async (email, otp, purpose = 'verify') => {
    const { subject, html } = otpEmail(otp, purpose, email);

    if (!useMailServer && !hasResend && !transporter) {
      if (isProduction) {
        console.error('Email is not configured: set EMAIL_API_URL + EMAIL_API_KEY, RESEND_API_KEY, or SMTP_USER/SMTP_PASS.');
        throw new Error('We could not send the verification email. Please try again later.');
      }
      logOtpForDev(email, otp, 'NO EMAIL PROVIDER CONFIGURED');
      return true;
    }

    try {
      if (useMailServer) {
        await sendViaMailServer(purpose === 'reset' ? 'otp-reset' : 'otp-verify', email, subject, html);
      } else if (hasResend) {
        await sendViaResend(email, subject, html);
      } else {
        const info = await transporter.sendMail({ from: FROM_ADDRESS, to: email, subject, html });
        console.log('OTP email sent successfully: %s', info.messageId);
      }
      return true;
    } catch (error) {
      console.error(`[Email] OTP delivery failed: ${error.message}`);
      if (isProduction) {
        // Tell the caller the truth: pretending the code was sent leaves the user stuck waiting
        throw new Error('We could not send the verification email. Please try again.');
      }
      logOtpForDev(email, otp, `EMAIL DELIVERY FAILED (${error.message})`);
      return true;
    }
  }
};
