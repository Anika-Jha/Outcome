import { NextResponse } from "next/server";
import { buildCriteria } from "@/lib/ai";
import { createOutcome, listOutcomes } from "@/lib/store";
import { errorResponse, readJson } from "@/lib/http";
import { hasOperatorSession } from "@/lib/session";
export async function GET() { return NextResponse.json({ outcomes: listOutcomes() }); }
export async function POST(request: Request) {
  try {
    if (!hasOperatorSession(request)) return errorResponse(new Error("Operator login required to create an outcome."), 401);
    const body = await readJson(request);
    const title = String(body.title || "").trim(); const description = String(body.description || "").trim();
    const recipient = String(body.recipient || "").trim(); const amount = Number(body.amount);
    if (!title || !description || !recipient) return errorResponse(new Error("Title, description and recipient are required."));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return errorResponse(new Error("Amount must be greater than 0 and no more than 100,000 USD."));
    const dueDate = body.dueDate ? String(body.dueDate) : null;
    if (dueDate && Number.isNaN(Date.parse(dueDate))) return errorResponse(new Error("Due date is invalid."));
    const generated = await buildCriteria(description);
    const outcome = createOutcome({ title, description, recipient, amount, dueDate, criteria: generated.criteria });
    return NextResponse.json({ outcome, criteriaModel: generated.model }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
