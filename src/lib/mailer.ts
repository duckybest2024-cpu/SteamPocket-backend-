import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? "GrilledCoin <noreply@casino-aurelius.app>";

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
 * Send an email verification link.
 * If SMTP is not configured, the link is printed to stdout so it can be found in Railway logs.
 */
export async function sendVerificationEmail(
  to: string,
  username: string,
  verificationUrl: string
): Promise<void> {
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`\n[EMAIL VERIFICATION — no SMTP configured]`);
    console.log(`  To:   ${username} <${to}>`);
    console.log(`  Link: ${verificationUrl}\n`);
    return;
  }

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: "Verify your GrilledCoin email",
    text: [
      `Hi ${username},`,
      ``,
      `Please verify your email address by clicking the link below:`,
      `${verificationUrl}`,
      ``,
      `This link expires in 24 hours.`,
      `If you didn't create this account, you can ignore this email.`,
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#6f5cf2">🍖 GrilledCoin</h2>
        <p>Hi <strong>${username}</strong>,</p>
        <p>Please verify your email address to finish creating your account.</p>
        <p style="margin:24px 0">
          <a href="${verificationUrl}"
             style="background:#6f5cf2;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
            Verify my email
          </a>
        </p>
        <p style="color:#888;font-size:0.85em">
          Or copy this URL into your browser:<br/>
          <a href="${verificationUrl}" style="color:#6f5cf2">${verificationUrl}</a>
        </p>
        <p style="color:#888;font-size:0.85em">This link expires in 24 hours.</p>
      </div>`,
  });
}
