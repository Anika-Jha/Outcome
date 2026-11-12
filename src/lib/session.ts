import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
const cookieName = "outcome_operator";
function secret() { return process.env.OUTCOME_SESSION_SECRET || process.env.OUTCOME_ACCESS_PASSWORD || ""; }
function signature(payload: string) { return createHmac("sha256", secret()).update(payload).digest("base64url"); }
export function createSessionCookie() {
  if (!secret()) throw new Error("Configure OUTCOME_SESSION_SECRET before enabling operator sessions.");
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  return `${cookieName}=${payload}.${signature(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function hasOperatorSession(request: Request) {
  const password = process.env.OUTCOME_ACCESS_PASSWORD;
  if (!password || !secret()) return false;
  const raw = request.headers.get("cookie") || "";
  const value = raw.split(";").map((x) => x.trim()).find((x) => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!value) return false;
  const [payload, supplied] = value.split("."); if (!payload || !supplied) return false;
  const expected = signature(payload);
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now(); } catch { return false; }
}
