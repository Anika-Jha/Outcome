import { NextResponse } from "next/server";
import { addEvidence, getOutcome } from "@/lib/store";
import { errorResponse, readJson } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const expected = process.env.POSTMAN_WEBHOOK_SECRET;
    if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return errorResponse(new Error("POSTMAN_WEBHOOK_SECRET is missing or the integration token is invalid."), 401);
    const body = await readJson(request); const outcomeId = String(body.outcomeId || ""); const outcome = getOutcome(outcomeId);
    if (!outcome) return NextResponse.json({ message: "Outcome not found" }, { status: 404 });
    if (!["AUTHORIZED", "VERIFYING", "REVIEW"].includes(outcome.status)) return errorResponse(new Error("Evidence can only be ingested for an authorized, active outcome."), 409);
    const stats = body.run?.stats || body.stats || {};
    const failed = Number(stats.assertions?.failed ?? stats.failed ?? 0);
    const passed = Number(stats.assertions?.passed ?? stats.passed ?? 0);
    const total = passed + failed;
    const evidence = addEvidence(outcomeId, { kind: "POSTMAN_TEST_RUN", notes: `Postman run: ${passed} passed, ${failed} failed.`, payload: { source: "Postman", run: body.run || body, stats, total, passed, failed, allPassed: total > 0 && failed === 0 } });
    return NextResponse.json({ accepted: true, evidence }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
