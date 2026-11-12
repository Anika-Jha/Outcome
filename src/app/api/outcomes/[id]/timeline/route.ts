import { NextResponse } from "next/server";
import { getOutcome, listAudit } from "@/lib/store";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const outcome = getOutcome(id);
  if (!outcome) return NextResponse.json({ message: "Outcome not found" }, { status: 404 });
  const startDate = outcome.createdAt; const endDate = outcome.dueDate || outcome.createdAt;
  return NextResponse.json({ events: [
    { id: `${id}-created`, name: "Agreement created", startDate, endDate: startDate, status: "completed" },
    ...(outcome.paypalAuthorizationId ? [{ id: `${id}-authorized`, name: "PayPal authorized", startDate: listAudit(id).find((x: any) => x.event === "PAYPAL_AUTHORIZED")?.createdAt || startDate, endDate: listAudit(id).find((x: any) => x.event === "PAYPAL_AUTHORIZED")?.createdAt || startDate, status: "completed" }] : []),
    ...(outcome.verification ? [{ id: `${id}-verification`, name: "AI verification", startDate: outcome.verification.createdAt, endDate: outcome.verification.createdAt, status: outcome.verification.status.toLowerCase() }] : []),
    ...(outcome.status === "PAID" ? [{ id: `${id}-paid`, name: "Payment captured", startDate: listAudit(id).find((x: any) => x.event === "PAYPAL_CAPTURED")?.createdAt || endDate, endDate: listAudit(id).find((x: any) => x.event === "PAYPAL_CAPTURED")?.createdAt || endDate, status: "completed" }] : []),
  ] });
}
