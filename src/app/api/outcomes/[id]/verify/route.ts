import { NextResponse } from "next/server";
import { verifyOutcome } from "@/lib/ai";
import { audit, getOutcome, updateOutcome } from "@/lib/store";
import { errorResponse } from "@/lib/http";
import { hasOperatorSession } from "@/lib/session";
async function indexElastic(document: unknown) {
  const url = process.env.ELASTICSEARCH_URL; const key = process.env.ELASTICSEARCH_API_KEY;
  if (!url || !key) return;
  await fetch(`${url.replace(/\/$/, "")}/outcome-evidence/_doc`, { method: "POST", headers: { Authorization: `ApiKey ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(document), cache: "no-store" }).catch(() => undefined);
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!hasOperatorSession(request)) return errorResponse(new Error("Operator login required to run verification."), 401);
    const { id } = await context.params; const outcome = getOutcome(id);
    if (!outcome) return NextResponse.json({ message: "Outcome not found" }, { status: 404 });
    if (!outcome.paypalAuthorizationId) return errorResponse(new Error("Authorize the PayPal payment before verification."), 409);
    if (!["AUTHORIZED", "VERIFYING", "REVIEW"].includes(outcome.status)) return errorResponse(new Error("This outcome is not eligible for verification."), 409);
    if (!outcome.evidence.length) return errorResponse(new Error("Submit at least one evidence item before verification."), 409);
    updateOutcome(id, { status: "VERIFYING" }); audit(id, "VERIFICATION_STARTED", { evidenceCount: outcome.evidence.length });
    const verification = await verifyOutcome({ title: outcome.title, description: outcome.description, criteria: outcome.criteria, evidence: outcome.evidence });
    // A PASS is a recommendation only. Human confirmation is required before capture.
    updateOutcome(id, { status: "REVIEW", verification }); audit(id, "VERIFICATION_COMPLETED", verification);
    await indexElastic({ outcomeId: id, title: outcome.title, verification, evidence: outcome.evidence, timestamp: new Date().toISOString() });
    if (process.env.ZAPIER_WEBHOOK_URL) await fetch(process.env.ZAPIER_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "outcome.verified", outcomeId: id, verification }) }).catch(() => undefined);
    return NextResponse.json({ verification, outcome: getOutcome(id) });
  } catch (error) { return errorResponse(error); }
}
