import { NextResponse } from "next/server";
import { captureAuthorization } from "@/lib/paypal";
import { audit, getOutcome, updateOutcome } from "@/lib/store";
import { errorResponse, readJson } from "@/lib/http";
import { hasOperatorSession } from "@/lib/session";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!hasOperatorSession(request)) return errorResponse(new Error("Operator login required. Sign in before capturing a payment."), 401);
    const { id } = await context.params; const body = await readJson(request); const outcome = getOutcome(id);
    if (!outcome) return NextResponse.json({ message: "Outcome not found" }, { status: 404 });
    if (body.confirm !== true) return errorResponse(new Error("Explicit human confirmation is required."), 400);
    if (outcome.status === "PAID" && outcome.paypalCaptureId) return NextResponse.json({ status: "PAID", captureId: outcome.paypalCaptureId });
    if (outcome.status !== "REVIEW") return errorResponse(new Error("Outcome must be in REVIEW after verification before capture."), 409);
    if (outcome.verification?.status !== "PASS") return errorResponse(new Error("Payment cannot be captured: latest verification is not PASS."), 409);
    if (!outcome.paypalAuthorizationId) return errorResponse(new Error("No PayPal authorization exists for this outcome."), 409);
    if (outcome.paypalCaptureId) return NextResponse.json({ status: "PAID", captureId: outcome.paypalCaptureId });
    const result = await captureAuthorization(outcome.paypalAuthorizationId);
    const capture = result.id;
    if (!capture || result.status !== "COMPLETED") throw new Error(`PayPal capture did not complete (status: ${result.status || "unknown"}).`);
    updateOutcome(id, { status: "PAID", paypalCaptureId: capture }); audit(id, "PAYPAL_CAPTURED", { captureId: capture, status: result.status });
    if (process.env.ZAPIER_WEBHOOK_URL) await fetch(process.env.ZAPIER_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "outcome.paid", outcomeId: id, captureId: capture, amount: outcome.amount, currency: outcome.currency }) }).catch(() => undefined);
    return NextResponse.json({ status: "PAID", captureId: capture, paypal: result });
  } catch (error) { return errorResponse(error); }
}
