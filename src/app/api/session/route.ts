import { NextResponse } from "next/server";
import { createSessionCookie, hasOperatorSession } from "@/lib/session";
import { readJson } from "@/lib/http";
export async function GET(request: Request) {
  return NextResponse.json({ authenticated: hasOperatorSession(request) }, { status: hasOperatorSession(request) ? 200 : 401 });
}
export async function POST(request: Request) {
  const password = process.env.OUTCOME_ACCESS_PASSWORD;
  if (!password) return NextResponse.json({ message: "Set OUTCOME_ACCESS_PASSWORD on the server to enable settlement controls." }, { status: 503 });
  try {
    const body = await readJson(request);
    if (typeof body.password !== "string" || body.password !== password) return NextResponse.json({ message: "Incorrect operator password." }, { status: 401 });
    const response = NextResponse.json({ authenticated: true, expiresIn: 28800 });
    response.headers.set("Set-Cookie", createSessionCookie());
    return response;
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Could not create session." }, { status: 400 }); }
}
