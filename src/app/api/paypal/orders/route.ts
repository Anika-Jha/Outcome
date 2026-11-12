import { NextResponse } from "next/server";
import { createAuthorizationOrder } from "@/lib/paypal";
import { getOutcome, updateOutcome, audit } from "@/lib/store";
import { errorResponse, readJson } from "@/lib/http";
import { hasOperatorSession } from "@/lib/session";
export async function POST(request: Request) {
  try {
    if (!hasOperatorSession(request)) return errorResponse(new Error("Operator login required to create a PayPal order."), 401);
    const body = await readJson(request); const outcomeId = String(body.outcomeId || "");
    const outcome = getOutcome(outcomeId);
    if (!outcome) return NextResponse.json({ message: "Outcome not found" }, { status: 404 });
    if (outcome.status !== "DRAFT") return errorResponse(new Error("Only draft outcomes can start PayPal authorization."), 409);
    if (outcome.paypalOrderId) return NextResponse.json({ orderId: outcome.paypalOrderId });
    const order = await createAuthorizationOrder(outcome);
    updateOutcome(outcome.id, { paypalOrderId: order.id }); audit(outcome.id, "PAYPAL_ORDER_CREATED", { orderId: order.id, intent: "AUTHORIZE" });
    return NextResponse.json({ orderId: order.id });
  } catch (error) { return errorResponse(error); }
}
