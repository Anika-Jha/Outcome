import { NextResponse } from "next/server";
import { authorizeOrder } from "@/lib/paypal";
import { getOutcome, updateOutcome, audit } from "@/lib/store";
import { errorResponse, readJson } from "@/lib/http";
import { hasOperatorSession } from "@/lib/session";
export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    if (!hasOperatorSession(request)) return errorResponse(new Error("Operator login required to authorize this PayPal order."), 401);
    const { orderId } = await context.params; const body = await readJson(request); const outcomeId = String(body.outcomeId || "");
    const outcome = getOutcome(outcomeId);
    if (!outcome) return NextResponse.json({ message: "Outcome not found" }, { status: 404 });
    if (outcome.paypalOrderId !== orderId) return errorResponse(new Error("This PayPal order does not belong to the selected outcome."), 403);
    if (outcome.paypalAuthorizationId) return NextResponse.json({ status: "AUTHORIZED", authorized: true });
    const result = await authorizeOrder(orderId);
    const purchase = result.purchase_units?.find((unit: any) => unit.reference_id === outcomeId || unit.custom_id === outcomeId);
    const authorization = purchase?.payments?.authorizations?.[0];
    if (!authorization?.id || !["CREATED", "PENDING"].includes(authorization.status)) throw new Error("PayPal did not return a valid authorization for this outcome.");
    updateOutcome(outcomeId, { paypalAuthorizationId: authorization.id, status: "AUTHORIZED" });
    audit(outcomeId, "PAYPAL_AUTHORIZED", { orderId, authorizationId: authorization.id, paypalStatus: authorization.status });
    return NextResponse.json({ status: "AUTHORIZED", authorized: true, authorizationId: authorization.id });
  } catch (error) { return errorResponse(error); }
}
