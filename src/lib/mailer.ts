import nodemailer from "nodemailer";
import { getSiteConfig } from "./siteConfig";

// SMTP settings can come from the Admin Panel (Email Settings, stored in SiteConfig)
// or from environment variables — the DB value wins when both are set.
async function getSmtpSettings() {
  const [host, port, user, pass, from] = await Promise.all([
    getSiteConfig("smtp_host"),
    getSiteConfig("smtp_port"),
    getSiteConfig("smtp_user"),
    getSiteConfig("smtp_pass"),
    getSiteConfig("smtp_from"),
  ]);
  return {
    host: host || process.env.SMTP_HOST || "",
    port: Number(port || process.env.SMTP_PORT || 587),
    user: user || process.env.SMTP_USER || "",
    pass: pass || process.env.SMTP_PASS || "",
    from: from || process.env.SMTP_FROM || "GrilledCoin <noreply@grilledcoin.app>",
  };
}

async function getTransporter() {
  const settings = await getSmtpSettings();
  if (!settings.host) return { transporter: null, from: settings.from };
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: settings.user ? { user: settings.user, pass: settings.pass } : undefined,
    // Many PaaS hosts (Railway included) block outbound SMTP ports — fail fast
    // instead of hanging the request for nodemailer's 2-minute default.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
  return { transporter, from: settings.from };
}

// SendGrid's SMTP relay (port 587/465) is frequently blocked outbound by cloud
// hosts, while its HTTPS API (port 443) never is — so when SendGrid creds are
// detected, send over that API instead of SMTP.
function isSendGrid(settings: { host: string; user: string }): boolean {
  return settings.host.toLowerCase().includes("sendgrid") || settings.user.toLowerCase() === "apikey";
}

function splitFrom(from: string): { email: string; name?: string } {
  const match = from.match(/^(.*?)<(.+)>$/);
  if (!match) return { email: from.trim() };
  return { name: match[1].trim() || undefined, email: match[2].trim() };
}

async function sendViaSendGridApi(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<void> {
  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: splitFrom(from),
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`SendGrid rejected the email (${resp.status}): ${body.slice(0, 300) || "no details"}`);
  }
}

/**
 * Send a 6-digit email verification code.
 * If SMTP is not configured, the code is printed to stdout (dev/Railway logs) and
 * the caller is told so it can surface the code directly in the app as a fallback —
 * otherwise the user would be locked out with no way to ever receive it.
 * Returns true if the code was actually emailed, false if it only hit the logs.
 */
export async function sendVerificationCode(
  to: string,
  username: string,
  code: string
): Promise<boolean> {
  const settings = await getSmtpSettings();
  if (!settings.host) {
    console.log(`\n[EMAIL VERIFICATION — no SMTP configured]`);
    console.log(`  To:   ${username} <${to}>`);
    console.log(`  Code: ${code}\n`);
    return false;
  }

  const subject = `${code} — Verify your GrilledCoin email`;
  const text = [
    `Hi ${username},`,
    ``,
    `Your GrilledCoin verification code is: ${code}`,
    ``,
    `Enter this code in the app to verify your email.`,
    `This code expires in 15 minutes.`,
    `If you didn't create this account, you can ignore this email.`,
  ].join("\n");
  const html = `
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
      </div>`;

  if (isSendGrid(settings)) {
    await sendViaSendGridApi(settings.pass, settings.from, to, subject, text, html);
    return true;
  }

  const { transporter, from } = await getTransporter();
  if (!transporter) return false;
  await transporter.sendMail({ from, to, subject, text, html });
  return true;
}

/**
 * Send a one-off test email using the currently configured SMTP settings.
 * Throws if SMTP isn't configured at all, so the Admin Panel can surface a clear error.
 */
export async function sendTestEmail(to: string, username: string): Promise<void> {
  const settings = await getSmtpSettings();
  if (!settings.host) {
    throw new Error("SMTP isn't configured yet — fill in the fields above and save first.");
  }

  const subject = "GrilledCoin — Test Email";
  const text = `Hi ${username},\n\nThis is a test email from your GrilledCoin Admin Panel. If you received this, your SMTP settings are working correctly.`;
  const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#6f5cf2">🍖 GrilledCoin</h2>
        <p>Hi <strong>${username}</strong>,</p>
        <p>This is a test email from your GrilledCoin Admin Panel.</p>
        <p>If you received this, your SMTP settings are working correctly.</p>
      </div>`;

  if (isSendGrid(settings)) {
    await sendViaSendGridApi(settings.pass, settings.from, to, subject, text, html);
    return;
  }

  const { transporter, from } = await getTransporter();
  if (!transporter) throw new Error("SMTP isn't configured yet — fill in the fields above and save first.");
  await transporter.sendMail({ from, to, subject, text, html });
}
