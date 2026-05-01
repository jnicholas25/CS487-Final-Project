const nodemailer = require('nodemailer');
const env = require('../../config/environment');
const logger = require('../../utils/logger');

/**
 * Email Service — sends transactional emails via SMTP (nodemailer).
 *
 * Configuration (environment variables):
 *   SMTP_HOST     e.g. smtp.gmail.com
 *   SMTP_PORT     587 (TLS) or 465 (SSL)
 *   SMTP_SECURE   false for TLS (STARTTLS), true for SSL
 *   SMTP_USER     your Gmail address
 *   SMTP_PASS     Gmail App Password (16-char)
 *   EMAIL_FROM    "IPFMS <noreply@gmail.com>"
 *
 * For Gmail: enable 2-Step Verification, then create an App Password at
 *   https://myaccount.google.com/apppasswords
 *
 * Dev fallback: if SMTP is not configured the OTP is printed to the server
 * console so local development works without an email account.
 */

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null; // will fall back to console logging
  }

  _transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT || 587,
    secure: env.SMTP_SECURE || false, // true = SSL port 465, false = STARTTLS
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return _transporter;
}

/**
 * Send a generic email.
 * @param {{ to, subject, html, text }} options
 */
async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();

  if (!transporter) {
    // Dev/test fallback — log instead of sending
    logger.warn(`[Email] SMTP not configured. Email would have been sent to: ${to}`);
    logger.warn(`[Email] Subject: ${subject}`);
    if (text) logger.warn(`[Email] Body: ${text}`);
    return { messageId: 'dev-console-fallback' };
  }

  const info = await transporter.sendMail({
    from: env.EMAIL_FROM || `"IPFMS" <${env.SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });

  logger.info(`[Email] Sent to ${to} | Message-ID: ${info.messageId}`);
  return info;
}

/**
 * Send a login OTP verification email.
 * @param {{ to: string, otp: string, name: string }} params
 */
async function sendLoginOTP({ to, otp, name }) {
  const displayName = name || 'there';

  return sendEmail({
    to,
    subject: 'IPFMS — Your Login Verification Code',
    text: [
      `Hi ${displayName},`,
      '',
      `Your IPFMS login verification code is: ${otp}`,
      '',
      'This code expires in 5 minutes. Do not share it with anyone.',
      '',
      'If you did not attempt to log in, please ignore this email.',
      '',
      '— IPFMS Security Team',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#4f46e5;padding:28px 32px;">
              <p style="margin:0;font-size:1.6rem;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">⬡ IPFMS</p>
              <p style="margin:4px 0 0;font-size:0.85rem;color:#c7d2fe;">Intelligent Personal Finance</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;font-size:1.25rem;color:#111827;">Login Verification Code</h2>
              <p style="margin:0 0 24px;font-size:0.95rem;color:#4b5563;">Hi ${displayName},</p>
              <p style="margin:0 0 20px;font-size:0.95rem;color:#4b5563;">
                Use the code below to complete your IPFMS login:
              </p>

              <!-- OTP Box -->
              <div style="background:#f5f3ff;border:2px solid #e0e7ff;border-radius:10px;
                          padding:24px;text-align:center;margin:0 0 24px;">
                <span style="font-size:2.4rem;font-weight:800;letter-spacing:0.35em;
                             color:#4f46e5;font-family:'Courier New',monospace;">${otp}</span>
              </div>

              <p style="margin:0 0 8px;font-size:0.875rem;color:#6b7280;">
                ⏱ This code <strong>expires in 5 minutes</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:0.875rem;color:#6b7280;">
                🔒 Never share this code with anyone — IPFMS will never ask for it.
              </p>
              <p style="margin:0;font-size:0.8rem;color:#9ca3af;">
                If you didn't try to sign in, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:0.75rem;color:#9ca3af;text-align:center;">
                © ${new Date().getFullYear()} IPFMS · Intelligent Personal Finance Management System
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}

module.exports = { sendEmail, sendLoginOTP };
