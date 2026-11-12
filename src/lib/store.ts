import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type OutcomeStatus = "DRAFT" | "AUTHORIZED" | "VERIFYING" | "REVIEW" | "PAID" | "VOIDED";
export type Evidence = { id: string; outcomeId: string; kind: string; url: string | null; notes: string | null; payload: unknown; createdAt: string };
export type Outcome = {
  id: string; title: string; description: string; amount: number; currency: string; recipient: string;
  createdAt: string; dueDate: string | null; status: OutcomeStatus; criteria: string[];
  paypalOrderId: string | null; paypalAuthorizationId: string | null; paypalCaptureId: string | null;
  verification: VerificationResult | null; evidence: Evidence[];
};
export type VerificationResult = { status: "PASS" | "FAIL" | "REVIEW"; confidence: number; summary: string; criteria: { criterion: string; status: "PASS" | "FAIL" | "REVIEW"; evidence: string }[]; model: string; createdAt: string };

const dbPath = process.env.OUTCOME_DB_PATH || path.join(process.cwd(), "data", "outcome.sqlite");
mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS outcomes (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD', recipient TEXT NOT NULL, created_at TEXT NOT NULL,
    due_date TEXT, status TEXT NOT NULL DEFAULT 'DRAFT', criteria_json TEXT NOT NULL DEFAULT '[]',
    paypal_order_id TEXT, paypal_authorization_id TEXT, paypal_capture_id TEXT,
    verification_json TEXT
  );
  CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY, outcome_id TEXT NOT NULL REFERENCES outcomes(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, url TEXT, notes TEXT, payload_json TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY, outcome_id TEXT NOT NULL REFERENCES outcomes(id) ON DELETE CASCADE,
    event TEXT NOT NULL, details_json TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_outcomes_created ON outcomes(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_evidence_outcome ON evidence(outcome_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_outcome ON audit_events(outcome_id, created_at DESC);
`);

function mapOutcome(row: any): Outcome {
  const evidenceRows = db.prepare("SELECT * FROM evidence WHERE outcome_id = ? ORDER BY created_at DESC").all(row.id) as any[];
  return {
    id: row.id, title: row.title, description: row.description, amount: row.amount, currency: row.currency,
    recipient: row.recipient, createdAt: row.created_at, dueDate: row.due_date, status: row.status,
    criteria: JSON.parse(row.criteria_json || "[]"), paypalOrderId: row.paypal_order_id,
    paypalAuthorizationId: row.paypal_authorization_id, paypalCaptureId: row.paypal_capture_id,
    verification: row.verification_json ? JSON.parse(row.verification_json) : null,
    evidence: evidenceRows.map((e) => ({ id: e.id, outcomeId: e.outcome_id, kind: e.kind, url: e.url,
      notes: e.notes, payload: e.payload_json ? JSON.parse(e.payload_json) : null, createdAt: e.created_at })),
  };
}

export function listOutcomes(): Outcome[] {
  return (db.prepare("SELECT * FROM outcomes ORDER BY created_at DESC").all() as any[]).map(mapOutcome);
}
export function getOutcome(id: string): Outcome | null {
  const row = db.prepare("SELECT * FROM outcomes WHERE id = ?").get(id) as any;
  return row ? mapOutcome(row) : null;
}
export function createOutcome(input: { title: string; description: string; amount: number; recipient: string; dueDate?: string | null; criteria: string[] }): Outcome {
  const id = `OUT-${randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO outcomes (id,title,description,amount,currency,recipient,created_at,due_date,status,criteria_json)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, input.title, input.description, input.amount, "USD", input.recipient, now, input.dueDate || null, "DRAFT", JSON.stringify(input.criteria));
  audit(id, "OUTCOME_CREATED", { title: input.title, amount: input.amount, criteria: input.criteria });
  return getOutcome(id)!;
}
export function updateOutcome(id: string, patch: Record<string, unknown>): Outcome | null {
  const fields: Record<string, string> = { status: "status", paypalOrderId: "paypal_order_id", paypalAuthorizationId: "paypal_authorization_id", paypalCaptureId: "paypal_capture_id", verification: "verification_json" };
  const sets: string[] = []; const values: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    const column = fields[key]; if (!column) continue;
    sets.push(`${column} = ?`);
    values.push(key === "verification" ? JSON.stringify(value) : value);
  }
  if (sets.length) { values.push(id); db.prepare(`UPDATE outcomes SET ${sets.join(", ")} WHERE id = ?`).run(...values); }
  return getOutcome(id);
}
export function addEvidence(id: string, input: { kind: string; url?: string | null; notes?: string | null; payload?: unknown }): Evidence {
  const evidence: Evidence = { id: randomUUID(), outcomeId: id, kind: input.kind, url: input.url || null,
    notes: input.notes || null, payload: input.payload ?? null, createdAt: new Date().toISOString() };
  db.prepare("INSERT INTO evidence (id,outcome_id,kind,url,notes,payload_json,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(evidence.id, id, evidence.kind, evidence.url, evidence.notes, JSON.stringify(evidence.payload), evidence.createdAt);
  // Any new evidence invalidates a previous PASS so stale evidence can never authorize capture.
  db.prepare("UPDATE outcomes SET status = 'VERIFYING', verification_json = NULL WHERE id = ?").run(id);
  audit(id, "EVIDENCE_SUBMITTED", { evidenceId: evidence.id, kind: evidence.kind, url: evidence.url });
  return evidence;
}
export function audit(id: string, event: string, details: unknown) {
  db.prepare("INSERT INTO audit_events (id,outcome_id,event,details_json,created_at) VALUES (?,?,?,?,?)")
    .run(randomUUID(), id, event, JSON.stringify(details ?? {}), new Date().toISOString());
}
export function listAudit(id: string) {
  return db.prepare("SELECT id,event,details_json AS details,created_at AS createdAt FROM audit_events WHERE outcome_id = ? ORDER BY created_at DESC")
    .all(id).map((row: any) => ({ ...row, details: JSON.parse(row.details) }));
}
