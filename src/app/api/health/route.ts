import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ ok: true, service: "outcome-api", integrations: {
    database: "sqlite", paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    gemini: Boolean(process.env.GEMINI_API_KEY), elastic: Boolean(process.env.ELASTICSEARCH_URL && process.env.ELASTICSEARCH_API_KEY), postman: Boolean(process.env.POSTMAN_WEBHOOK_SECRET), kernel: Boolean(process.env.KERNEL_WEBHOOK_SECRET), zapier: Boolean(process.env.ZAPIER_WEBHOOK_URL),
  } });
}
