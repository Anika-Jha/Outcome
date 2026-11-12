import { NextResponse } from "next/server";
import { addEvidence, audit, getOutcome } from "@/lib/store";
import { errorResponse, readJson } from "@/lib/http";
import { hasOperatorSession } from "@/lib/session";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!hasOperatorSession(request)) return errorResponse(new Error("Operator login required to submit evidence."), 401);
    const { id } = await context.params; const outcome = getOutcome(id);
    if (!outcome) return NextResponse.json({ message: "Outcome not found" }, { status: 404 });
    if (!["AUTHORIZED", "VERIFYING", "REVIEW"].includes(outcome.status)) return errorResponse(new Error("Evidence can only be submitted after payment authorization."), 409);
    const body = await readJson(request); const kind = String(body.kind || "SUBMISSION").slice(0, 40);
    const url = body.url ? String(body.url).trim() : null;
    if (url) { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return errorResponse(new Error("Evidence URL must be a public HTTP or HTTPS URL.")); }
    const notes = body.notes ? String(body.notes).slice(0, 4000) : null;
    if (!url && !notes && body.payload == null) return errorResponse(new Error("Provide an evidence URL, notes, or structured payload."));
    const evidence = addEvidence(id, { kind, url, notes, payload: body.payload ?? null });
    audit(id, "OUTCOME_SUBMITTED", { evidenceId: evidence.id });
    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
