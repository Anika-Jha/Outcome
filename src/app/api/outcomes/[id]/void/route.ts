import { NextResponse } from "next/server";
import { voidAuthorization } from "@/lib/paypal";
import { audit, getOutcome, updateOutcome } from "@/lib/store";
import { errorResponse, readJson } from "@/lib/http";
import { hasOperatorSession } from "@/lib/session";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!hasOperatorSession(request)) return errorResponse(new Error("Operator login required. Sign in before voiding an authorization."), 401);
    const { id } = await context.params; const body = await readJson(request); const outcome = getOutcome(id);
    if (!outcome) return NextResponse.json({ message: "Outcome not found" }, { status: 404 });
    if (body.confirm !== true) return errorResponse(new Error("Explicit confirmation is required to void the authorization."), 400);
    if (!outcome.paypalAuthorizationId) return errorResponse(new Error("No authorization exists to void."), 409);
    if (outcome.status === "VOIDED") return NextResponse.json({ status: "VOIDED" });
    if (outcome.status === "PAID") return errorResponse(new Error("A captured payment cannot be voided. Use a refund workflow."), 409);
    await voidAuthorization(outcome.paypalAuthorizationId);
    updateOutcome(id, { status: "VOIDED" }); audit(id, "PAYPAL_AUTHORIZATION_VOIDED", { authorizationId: outcome.paypalAuthorizationId });
    return NextResponse.json({ status: "VOIDED" });
  } catch (error) { return errorResponse(error); }
}
