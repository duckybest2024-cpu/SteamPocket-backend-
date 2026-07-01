import { getSiteConfig } from "./siteConfig";

async function getPaypalCreds() {
  const [clientId, secret, mode] = await Promise.all([
    getSiteConfig("paypal_client_id"),
    getSiteConfig("paypal_client_secret"),
    getSiteConfig("paypal_mode"),
  ]);
  return {
    clientId: clientId || process.env.PAYPAL_CLIENT_ID || "",
    secret: secret || process.env.PAYPAL_CLIENT_SECRET || "",
    base:
      (mode || process.env.PAYPAL_MODE) === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com",
  };
}

export async function isPaypalConfigured(): Promise<boolean> {
  const { clientId, secret } = await getPaypalCreds();
  return Boolean(clientId && secret);
}

async function getAccessToken(): Promise<{ token: string; base: string }> {
  const { clientId, secret, base } = await getPaypalCreds();
  if (!clientId || !secret) throw new Error("PayPal is not configured");

  const resp = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!resp.ok) throw new Error(`PayPal authentication failed (${resp.status})`);
  const data = (await resp.json()) as { access_token: string };
  return { token: data.access_token, base };
}

/**
 * Sends a real-money payout to a PayPal email via the Payouts API.
 * Returns the PayPal payout batch id on success.
 */
export async function sendPaypalPayout(
  email: string,
  amountUsd: number,
  note: string,
  senderBatchId: string
): Promise<string> {
  const { token, base } = await getAccessToken();

  const resp = await fetch(`${base}/v1/payments/payouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: "You've received a payout from GrilledCoin!",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: amountUsd.toFixed(2), currency: "USD" },
          receiver: email,
          note: note || "Prize payout",
        },
      ],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`PayPal payout failed (${resp.status}): ${body.slice(0, 300) || "no details"}`);
  }

  const data = (await resp.json()) as { batch_header?: { payout_batch_id?: string } };
  return data.batch_header?.payout_batch_id || senderBatchId;
}
