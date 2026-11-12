import { NextResponse } from "next/server";
import { getOutcome, listAudit } from "@/lib/store";
import { errorResponse } from "@/lib/http";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { id } = await context.params; const outcome = getOutcome(id); if (!outcome) return NextResponse.json({ message: "Outcome not found" }, { status: 404 }); return NextResponse.json({ outcome, audit: listAudit(id) }); }
  catch (error) { return errorResponse(error, 500); }
}
