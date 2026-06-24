import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? "GrilledCoin <noreply@grilledcoin.app>";

function getTransporter() {
  if (!SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

/**
 * Send a 6-digit email verification code.
 * If SMTP is not configured, the code is printed to stdout so it can be found in dev/Railway logs.
 */
export async function sendVerificationCode(
  to: string,
  username: string,
  code: string
): Promise<void> {
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`\n[EMAIL VERIFICATION — no SMTP configured]`);
    console.log(`  To:   ${username} <${to}>`);
    console.log(`  Code: ${code}\n`);
    return;
  }

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: `${code} — Verify your GrilledCoin email`,
    text: [
      `Hi ${username},`,
      ``,
      `Your GrilledCoin verification code is: ${code}`,
      ``,
      `Enter this code in the app to verify your email.`,
      `This code expires in 15 minutes.`,
      `If you didn't create this account, you can ignore this email.`,
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#6f5cf2">🍖 GrilledCoin</h2>
        <p>Hi <strong>${username}</strong>,</p>
        <p>Enter this code in the app to verify your email address:</p>
        <p style="margin:24px 0;text-align:center">
          <span style="display:inline-block;background:#6f5cf2;color:white;padding:14px 28px;border-radius:8px;font-weight:700;font-size:1.6rem;letter-spacing:4px">
            ${code}
          </span>
        </p>
        <p style="color:#888;font-size:0.85em">This code expires in 15 minutes.</p>
      </div>`,
  });
}
