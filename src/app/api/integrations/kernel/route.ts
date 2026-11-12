import { NextResponse } from "next/server";
import { addEvidence, getOutcome } from "@/lib/store";
import { errorResponse, readJson } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const secret = process.env.KERNEL_WEBHOOK_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return errorResponse(new Error("KERNEL_WEBHOOK_SECRET is not configured or token is invalid."), 401);
    const body = await readJson(request); const outcomeId = String(body.outcomeId || ""); const outcome = getOutcome(outcomeId);
    if (!outcome) return NextResponse.json({ message: "Outcome not found" }, { status: 404 });
    if (!["AUTHORIZED", "VERIFYING", "REVIEW"].includes(outcome.status)) return errorResponse(new Error("Evidence can only be ingested for an authorized, active outcome."), 409);
    const checks = Array.isArray(body.checks) ? body.checks.slice(0, 100) : [];
    if (!checks.length) return errorResponse(new Error("KERNEL report must include a non-empty checks array."));
    const evidence = addEvidence(outcomeId, { kind: "KERNEL_BROWSER_REPORT", url: body.url ? String(body.url) : null, notes: String(body.summary || "Browser verification report received from KERNEL."), payload: { source: "KERNEL", url: body.url || null, checks, result: body.result || null, sessionId: body.sessionId || null } });
    return NextResponse.json({ accepted: true, evidence }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
