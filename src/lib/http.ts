import { NextResponse } from "next/server";
export function errorResponse(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return NextResponse.json({ message }, { status });
}
export async function readJson(request: Request) {
  try { return await request.json(); } catch { throw new Error("Request body must be valid JSON"); }
}
