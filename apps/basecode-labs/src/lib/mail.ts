import nodemailer from 'nodemailer';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function smtpReady() {
  return Boolean(
    process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim(),
  );
}

export async function sendOtpEmail(
  to: string,
  code: string,
): Promise<{ delivered: boolean; dev: boolean }> {
  const text = `Your BaseCode Central login code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`;
  const html = `<p>Your BaseCode Central login code is:</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p>
<p>This code expires in 10 minutes. If you did not request it, ignore this email.</p>
<p>— BaseCode Labs Pvt. Ltd.</p>`;

  if (!smtpReady()) {
    if (isProduction()) {
      console.error(
        '[BaseCode OTP] SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.',
      );
      return { delivered: false, dev: false };
    }
    console.info(`[BaseCode OTP] ${to}: ${code}`);
    return { delivered: false, dev: true };
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure =
    process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1' || port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER as string,
      pass: process.env.SMTP_PASS as string,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? 'BaseCode Labs <contact@basecodelabs.com>',
    to,
    subject: 'Your BaseCode Central login code',
    text,
    html,
  });
  return { delivered: true, dev: false };
}
