
import "server-only";
import { randomUUID } from "node:crypto";

const baseUrl = () =>
  process.env.PAYPAL_BASE_URL ||
  (process.env.PAYPAL_ENVIRONMENT === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com");

function credentials() {
  const client = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;

  if (!client || !secret) {
    throw new Error(
      "PayPal server credentials are missing. Configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET."
    );
  }

  return { client, secret };
}

async function accessToken() {
  const { client, secret } = credentials();

  const response = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${client}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error_description || data.message || "PayPal authentication failed"
    );
  }

  return data.access_token as string;
}

async function paypalRequest(
  path: string,
  method: string,
  body?: unknown,
  requestId = randomUUID()
) {
  const token = await accessToken();

  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": requestId,
      Prefer: "return=representation",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
        data.details?.[0]?.description ||
        `PayPal request failed (${response.status})`
    );
  }

  return data;
}

export async function createAuthorizationOrder(outcome: {
  id: string;
  title: string;
  amount: number;
  currency: string;
}) {
  return paypalRequest("/v2/checkout/orders", "POST", {
    intent: "AUTHORIZE",
    purchase_units: [
      {
        reference_id: outcome.id,
        custom_id: outcome.id,
        description: outcome.title.slice(0, 127),
        amount: {
          currency_code: outcome.currency,
          value: outcome.amount.toFixed(2),
        },
      },
    ],
  });
}

export async function authorizeOrder(orderId: string) {
  return paypalRequest(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`,
    "POST",
    {}
  );
}

export async function captureAuthorization(authorizationId: string) {
  return paypalRequest(
    `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`,
    "POST",
    { final_capture: true }
  );
}

export async function voidAuthorization(authorizationId: string) {
  return paypalRequest(
    `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`,
    "POST",
    {}
  );
}
