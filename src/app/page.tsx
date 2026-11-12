
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import PayPalAuthorization from "../../components/PayPalAuthorization";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";

ModuleRegistry.registerModules([AllCommunityModule]);

type PageName = "Overview" | "Create Outcome" | "Contracts" | "Verification";

type OutcomeStatus =
  | "DRAFT"
  | "AUTHORIZED"
  | "VERIFYING"
  | "REVIEW"
  | "PAID"
  | "VOIDED";

type Outcome = {
  id: string;
  title: string;
  description: string;
  amount: number;
  recipient: string;
  createdAt: string;
  dueDate: string | null;
  status: OutcomeStatus;
  criteria?: string[];
  evidence?: { id: string; kind: string; url: string | null; notes: string | null; createdAt: string }[];
  verification?: { status: "PASS" | "FAIL" | "REVIEW"; confidence: number; summary: string; criteria: { criterion: string; status: "PASS" | "FAIL" | "REVIEW"; evidence: string }[]; model: string } | null;
  paypalAuthorizationId?: string | null;
};

const initialOutcomes: Outcome[] = [];

const navigation: {
  label: PageName;
  icon: typeof LayoutDashboard;
}[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Create Outcome", icon: Plus },
  { label: "Contracts", icon: FileText },
  { label: "Verification", icon: ShieldCheck },
];

const statusStyles: Record<OutcomeStatus, string> = {
  DRAFT: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  AUTHORIZED:
    "border-sky-400/25 bg-sky-400/10 text-sky-300",
  VERIFYING:
    "border-amber-400/25 bg-amber-400/10 text-amber-300",
  REVIEW:
    "border-violet-400/25 bg-violet-400/10 text-violet-300",
  PAID:
    "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  VOIDED: "border-rose-400/25 bg-rose-400/10 text-rose-300",
};

const currency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);

function StatusBadge({ status }: { status: OutcomeStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide ${statusStyles[status]}`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {status.replace("_", " ")}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-7">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300">
        {eyebrow}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
        {description}
      </p>
    </div>
  );
}

function StatCard({
  title,
  value,
  detail,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
  trend?: "up" | "down";
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#101719] p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-400">{title}</p>
        <div className="rounded-xl border border-emerald-300/10 bg-emerald-300/[0.07] p-2.5 text-emerald-200">
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-5 text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
        {trend === "up" ? (
          <ArrowUpRight size={13} className="text-emerald-300" />
        ) : trend === "down" ? (
          <ArrowDownRight size={13} className="text-rose-300" />
        ) : null}
        {detail}
      </div>
    </div>
  );
}

export default function Home() {
  const [activePage, setActivePage] = useState<PageName>("Overview");
  const [outcomes, setOutcomes] = useState<Outcome[]>(initialOutcomes);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OutcomeStatus>(
    "ALL"
  );
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRecipient, setFormRecipient] = useState("");
  const [formAmount, setFormAmount] = useState("500");
  const [formDueDate, setFormDueDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  async function refreshOutcomes(preferredId?: string) {
    const response = await fetch("/api/outcomes", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Could not load outcomes.");
    const rows = (data.outcomes || []) as Outcome[];
    setOutcomes(rows);
    if (preferredId && rows.some((item) => item.id === preferredId)) setSelectedOutcomeId(preferredId);
    else if (!rows.some((item) => item.id === selectedOutcomeId)) setSelectedOutcomeId(rows[0]?.id || "");
  }

  useEffect(() => {
    refreshOutcomes().catch((error) => setActionMessage(error instanceof Error ? error.message : "Could not load workspace."));
    // Initial load only; refreshes are triggered after mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedOutcome =
    outcomes.find((outcome) => outcome.id === selectedOutcomeId) ??
    outcomes[0];

  const totalValue = outcomes.reduce(
    (sum, outcome) => sum + outcome.amount,
    0
  );

  const authorizedValue = outcomes
    .filter((outcome) =>
      ["AUTHORIZED", "VERIFYING", "REVIEW"].includes(outcome.status)
    )
    .reduce((sum, outcome) => sum + outcome.amount, 0);

  const paidValue = outcomes
    .filter((outcome) => outcome.status === "PAID")
    .reduce((sum, outcome) => sum + outcome.amount, 0);

  const pendingCount = outcomes.filter((outcome) =>
    ["AUTHORIZED", "VERIFYING", "REVIEW"].includes(outcome.status)
  ).length;

  const filteredOutcomes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return outcomes.filter((outcome) => {
      const matchesSearch =
        !query ||
        outcome.id.toLowerCase().includes(query) ||
        outcome.title.toLowerCase().includes(query) ||
        outcome.recipient.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" || outcome.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [outcomes, searchQuery, statusFilter]);

  const columnDefs = useMemo<ColDef<Outcome>[]>(
    () => [
      {
        headerName: "OUTCOME",
        field: "title",
        flex: 1.7,
        minWidth: 190,
        sortable: true,
        filter: true,
        cellRenderer: (params: { data?: Outcome }) => {
          const outcome = params.data;
          if (!outcome) return null;

          return (
            <div className="flex h-full flex-col justify-center gap-1 py-2">
              <span className="font-medium text-slate-100">
                {outcome.title}
              </span>
              <span className="text-[10px] text-slate-500">
                {outcome.id}
              </span>
            </div>
          );
        },
      },
      {
        headerName: "RECIPIENT",
        field: "recipient",
        flex: 1,
        minWidth: 130,
        sortable: true,
        filter: true,
      },
      {
        headerName: "AMOUNT",
        field: "amount",
        flex: 0.7,
        minWidth: 105,
        sortable: true,
        valueFormatter: (params) =>
          typeof params.value === "number" ? currency(params.value) : "",
      },
      {
        headerName: "STATUS",
        field: "status",
        flex: 1,
        minWidth: 130,
        sortable: true,
        cellRenderer: (params: { value?: OutcomeStatus }) =>
          params.value ? <StatusBadge status={params.value} /> : null,
      },
      {
        headerName: "DUE DATE",
        field: "dueDate",
        flex: 0.8,
        minWidth: 115,
        sortable: true,
      },
    ],
    []
  );

  const gridTheme = useMemo(
    () =>
      themeQuartz.withParams({
        backgroundColor: "#101719",
        foregroundColor: "#dbe4e5",
        headerBackgroundColor: "#141d1f",
        headerTextColor: "#839395",
        borderColor: "rgba(255,255,255,0.07)",
        rowHoverColor: "rgba(110,231,183,0.045)",
        selectedRowBackgroundColor: "rgba(110,231,183,0.08)",
        fontFamily: "Arial, sans-serif",
        fontSize: 12,
        spacing: 6,
        wrapperBorderRadius: 12,
      }),
    []
  );

  function navigateTo(page: PageName) {
    setActivePage(page);
    setMobileMenuOpen(false);
  }

  async function createOutcome(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(formAmount);
    if (!formTitle.trim() || !formRecipient.trim() || amount <= 0) return;

    setIsSaving(true);
    setActionMessage("");
    try {
      if (!(await operatorLogin())) return;
      const response = await fetch("/api/outcomes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: formTitle.trim(), description: formDescription.trim(), recipient: formRecipient.trim(), amount, dueDate: formDueDate || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not create outcome.");
      await refreshOutcomes(data.outcome.id);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Could not create outcome.");
      return;
    } finally { setIsSaving(false); }
    setFormTitle("");
    setFormDescription("");
    setFormRecipient("");
    setFormAmount("500");
    setFormDueDate("");
    setActivePage("Contracts");
  }

  async function submitEvidence() {
    if (!selectedOutcome) return;
    setIsWorking(true); setActionMessage("");
    try {
      if (!(await operatorLogin())) return;
      const response = await fetch(`/api/outcomes/${selectedOutcome.id}/evidence`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "DELIVERABLE", url: evidenceUrl || null, notes: evidenceNotes || null }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Evidence submission failed.");
      setEvidenceUrl(""); setEvidenceNotes(""); await refreshOutcomes(selectedOutcome.id); setActionMessage("Evidence submitted and recorded.");
    } catch (error) { setActionMessage(error instanceof Error ? error.message : "Evidence submission failed."); }
    finally { setIsWorking(false); }
  }
  async function runVerification() {
    if (!selectedOutcome) return;
    setIsWorking(true); setActionMessage("");
    try {
      if (!(await operatorLogin())) return;
      const response = await fetch(`/api/outcomes/${selectedOutcome.id}/verify`, { method: "POST" });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Verification failed.");
      await refreshOutcomes(selectedOutcome.id); setActionMessage(`Verification result: ${data.verification.status}. ${data.verification.summary}`);
    } catch (error) { setActionMessage(error instanceof Error ? error.message : "Verification failed."); }
    finally { setIsWorking(false); }
  }
  async function operatorLogin() {
    const existing = await fetch("/api/session", { cache: "no-store" });
    if (existing.ok) return true;
    const password = window.prompt("Enter the OUTCOME operator password:");
    if (!password) return false;
    const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Operator login failed.");
    return true;
  }
  async function settleOutcome() {
    if (!selectedOutcome || !window.confirm(`Capture ${currency(selectedOutcome.amount)} through PayPal? This cannot be undone.`)) return;
    setIsWorking(true); setActionMessage("");
    try {
      if (!(await operatorLogin())) return;
      const response = await fetch(`/api/outcomes/${selectedOutcome.id}/settle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Settlement failed.");
      await refreshOutcomes(selectedOutcome.id); setActionMessage("PayPal capture completed.");
    } catch (error) { setActionMessage(error instanceof Error ? error.message : "Settlement failed."); }
    finally { setIsWorking(false); }
  }
  async function voidOutcome() {
    if (!selectedOutcome || !window.confirm("Void this PayPal authorization?")) return;
    setIsWorking(true); setActionMessage("");
    try {
      if (!(await operatorLogin())) return;
      const response = await fetch(`/api/outcomes/${selectedOutcome.id}/void`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Void failed.");
      await refreshOutcomes(selectedOutcome.id); setActionMessage("PayPal authorization voided.");
    } catch (error) { setActionMessage(error instanceof Error ? error.message : "Void failed."); }
    finally { setIsWorking(false); }
  }

  const pageContent = () => {
    if (activePage === "Create Outcome") {
      return (
        <>
          <SectionHeading
            eyebrow="New agreement"
            title="Create an outcome"
            description="Define the deliverable, recipient and acceptance conditions before starting a conditional payment."
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
            <form
              onSubmit={createOutcome}
              className="rounded-2xl border border-white/[0.07] bg-[#101719] p-5 sm:p-7"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-emerald-300/10 p-2.5 text-emerald-200">
                  <FileCheck2 size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-white">
                    Outcome details
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Specify what completion should look like.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-slate-300">
                    Outcome title
                  </span>
                  <input
                    required
                    value={formTitle}
                    onChange={(event) => setFormTitle(event.target.value)}
                    placeholder="e.g. Build a responsive landing page"
                    className="w-full rounded-xl border border-white/10 bg-[#0a1011] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-slate-300">
                    Description and acceptance requirements
                  </span>
                  <textarea
                    required
                    rows={4}
                    value={formDescription}
                    onChange={(event) =>
                      setFormDescription(event.target.value)
                    }
                    placeholder="Describe the deliverables and how they should be evaluated..."
                    className="w-full resize-y rounded-xl border border-white/10 bg-[#0a1011] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-slate-300">
                    Recipient name or identifier
                  </span>
                  <input
                    required
                    value={formRecipient}
                    onChange={(event) => setFormRecipient(event.target.value)}
                    placeholder="e.g. Developer or vendor"
                    className="w-full rounded-xl border border-white/10 bg-[#0a1011] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50"
                  />
                </label>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-slate-300">
                      Payment amount (USD)
                    </span>
                    <div className="flex items-center rounded-xl border border-white/10 bg-[#0a1011] px-3 focus-within:border-emerald-300/50">
                      <span className="text-sm text-slate-500">$</span>
                      <input
                        required
                        min="1"
                        type="number"
                        value={formAmount}
                        onChange={(event) => setFormAmount(event.target.value)}
                        className="w-full bg-transparent px-2 py-3 text-sm text-white outline-none"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-medium text-slate-300">
                      Target due date
                    </span>
                    <input
                      type="date"
                      value={formDueDate}
                      onChange={(event) => setFormDueDate(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#0a1011] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300/50"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#07110d] transition hover:bg-emerald-200"
                  disabled={isSaving}
                >
                  {isSaving ? "Creating…" : "Create draft"} <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo("Overview")}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm text-slate-300 transition hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
              </div>
              {actionMessage && <p role="alert" className="mt-3 text-xs text-rose-300">{actionMessage}</p>}
              <p className="mt-4 text-[11px] leading-5 text-slate-500">
                Creating a draft saves it to the backend and generates acceptance criteria. No money moves until the buyer authorizes through PayPal.
              </p>
            </form>

            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-5">
                <div className="mb-4 flex items-center gap-2 text-emerald-200">
                  <Sparkles size={17} />
                  <h3 className="text-sm font-semibold">
                    How OUTCOME works
                  </h3>
                </div>
                {[
                  ["01", "Define", "Agree on measurable acceptance criteria."],
                  ["02", "Authorize", "Authorize payment through PayPal."],
                  ["03", "Submit", "Provide evidence of completed work."],
                  ["04", "Verify", "Evaluate evidence and resolve ambiguity."],
                  ["05", "Settle", "Capture or void through the backend."],
                ].map(([number, title, description]) => (
                  <div key={number} className="flex gap-3 py-3">
                    <span className="pt-0.5 text-xs font-semibold text-emerald-300">
                      {number}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-100">
                        {title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-[#101719] p-5">
                <div className="flex items-start gap-3">
                  <LockKeyhole
                    size={18}
                    className="mt-0.5 shrink-0 text-slate-400"
                  />
                  <div>
                    <h3 className="text-sm font-medium text-white">
                      Payment safety
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      The intended flow keeps payment authorization separate
                      from capture. A backend should enforce amount limits,
                      authorization expiry, verification rules and human
                      review before settlement.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      );
    }

    if (activePage === "Contracts") {
      return (
        <>
          <SectionHeading
            eyebrow="Workspace"
            title="Outcome contracts"
            description="Search agreements, inspect their current status and review the outcome details."
          />

          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101719]">
            <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <h2 className="font-semibold text-white">All outcomes</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {filteredOutcomes.length} records in this local workspace
                </p>
              </div>
              <button
                onClick={() => navigateTo("Create Outcome")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-[#07110d] hover:bg-emerald-200"
              >
                <Plus size={16} /> New outcome
              </button>
            </div>

            <div className="flex flex-col gap-3 p-4 sm:flex-row">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#0a1011] px-3">
                <Search size={16} className="shrink-0 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search title, recipient or ID..."
                  className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600"
                />
                {searchQuery && (
                  <button
                    aria-label="Clear search"
                    onClick={() => setSearchQuery("")}
                    className="text-slate-500 hover:text-white"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0a1011] px-3">
                <Filter size={15} className="text-slate-500" />
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as "ALL" | OutcomeStatus
                    )
                  }
                  className="w-full bg-transparent py-3 text-sm text-slate-300 outline-none"
                >
                  <option value="ALL">All statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="AUTHORIZED">Authorized</option>
                  <option value="VERIFYING">Verifying</option>
                  <option value="REVIEW">Review</option>
                  <option value="PAID">Paid</option>
                  <option value="VOIDED">Voided</option>
                </select>
              </div>
            </div>

            <div className="h-[360px] w-full px-2 pb-3 sm:px-4">
              <AgGridReact<Outcome>
                theme={gridTheme}
                rowData={filteredOutcomes}
                columnDefs={columnDefs}
                defaultColDef={{
                  resizable: true,
                  sortable: true,
                }}
                rowHeight={62}
                headerHeight={42}
                animateRows
                pagination
                paginationPageSize={5}
                onRowClicked={(event) => {
                  if (event.data) {
                    setSelectedOutcomeId(event.data.id);
                  }
                }}
                overlayNoRowsTemplate="No outcomes match your search."
              />
            </div>

            {selectedOutcome && (
              <div className="border-t border-white/[0.07] p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Selected outcome · {selectedOutcome.id}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {selectedOutcome.title}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                      {selectedOutcome.description ||
                        "No description provided."}
                    </p>
                    <p className="mt-3 text-xs text-slate-500">
                      Recipient: {selectedOutcome.recipient} · Due:{" "}
                      {selectedOutcome.dueDate}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                    <p className="text-xl font-semibold text-white">
                      {currency(selectedOutcome.amount)}
                    </p>
                    <StatusBadge status={selectedOutcome.status} />
                  </div>
                </div>
                <p className="mt-5 rounded-xl border border-amber-300/10 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100/70">
                  This agreement is stored by the backend. PayPal authorization places a temporary payment hold; capture happens only after verification passes and a human confirms settlement.
                </p>
                {selectedOutcome.status === "DRAFT" ? (
                  <PayPalAuthorization
                    outcomeId={selectedOutcome.id}
                    amount={selectedOutcome.amount}
                    onAuthorized={() => refreshOutcomes(selectedOutcome.id).catch(() => undefined)}
                  />
                ) : (
                  <p className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-xs leading-5 text-slate-400">
                    {selectedOutcome.status === "PAID" ? "Payment has been captured." : selectedOutcome.status === "VOIDED" ? "Authorization was voided." : "Payment is already authorized or awaiting review."}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      );
    }

    if (activePage === "Verification") {
      return (
        <>
          <SectionHeading
            eyebrow="Evidence review"
            title="Verification center"
            description="Review the selected outcome's requirements and evidence before any settlement decision."
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
            <div className="rounded-2xl border border-white/[0.07] bg-[#101719] p-5 sm:p-7">
              <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Outcome under review
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {selectedOutcome?.title ?? "No outcome selected"}
                  </h2>
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedOutcome?.id} ·{" "}
                    {selectedOutcome?.recipient}
                  </p>
                </div>
                {selectedOutcome && (
                  <StatusBadge status={selectedOutcome.status} />
                )}
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-xs font-medium text-slate-300">
                  Select an outcome
                </label>
                <select
                  value={selectedOutcomeId}
                  onChange={(event) =>
                    setSelectedOutcomeId(event.target.value)
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#0a1011] px-3 py-3 text-sm text-white outline-none focus:border-emerald-300/50"
                >
                  {outcomes.map((outcome) => (
                    <option key={outcome.id} value={outcome.id}>
                      {outcome.id} — {outcome.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-7 space-y-4">
                {[
                  {
                    title: "Acceptance criteria defined",
                    description:
                      "The agreed requirements should be recorded before work starts.",
                    icon: FileCheck2,
                  },
                  {
                    title: "Evidence submitted",
                    description:
                      "Attach a deliverable, URL, test report or other relevant proof.",
                    icon: FileText,
                  },
                  {
                    title: "Evidence evaluated",
                    description:
                      "Check each requirement against the actual submitted evidence.",
                    icon: ShieldCheck,
                  },
                  {
                    title: "Settlement decision reviewed",
                    description:
                      "Escalate uncertain or disputed outcomes to human review.",
                    icon: CheckCircle2,
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex gap-3 rounded-xl border border-white/[0.07] bg-[#0c1213] p-4"
                  >
                    <div className="mt-0.5 rounded-lg bg-white/[0.04] p-2 text-slate-400">
                      <item.icon size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-200">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-white/[0.07] bg-[#0c1213] p-4">
                <h3 className="text-sm font-semibold text-white">Acceptance criteria</h3>
                <div className="mt-3 space-y-2">
                  {(selectedOutcome?.criteria || []).map((criterion, index) => <p key={`${index}-${criterion}`} className="text-xs text-slate-300">{index + 1}. {criterion}</p>)}
                  {!selectedOutcome?.criteria?.length && <p className="text-xs text-slate-500">No criteria available.</p>}
                </div>
                <div className="mt-5 border-t border-white/[0.07] pt-4">
                  <h3 className="text-sm font-semibold text-white">Submit deliverable evidence</h3>
                  <input value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="Public website / GitHub / artifact URL (optional)" className="mt-3 w-full rounded-xl border border-white/10 bg-[#080d0e] px-3 py-3 text-xs text-white outline-none focus:border-emerald-300/50" />
                  <textarea value={evidenceNotes} onChange={(event) => setEvidenceNotes(event.target.value)} placeholder="Describe what was delivered, test results, or attach API test summary..." rows={3} className="mt-3 w-full rounded-xl border border-white/10 bg-[#080d0e] px-3 py-3 text-xs text-white outline-none focus:border-emerald-300/50" />
                  <button disabled={isWorking || !selectedOutcome || !["AUTHORIZED", "VERIFYING", "REVIEW"].includes(selectedOutcome.status)} onClick={submitEvidence} className="mt-3 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-medium text-slate-200 disabled:opacity-40">{isWorking ? "Working…" : "Submit evidence"}</button>
                </div>
                {selectedOutcome?.evidence?.length ? <div className="mt-4 space-y-2"><p className="text-xs font-semibold text-slate-300">Submitted evidence ({selectedOutcome.evidence.length})</p>{selectedOutcome.evidence.map((item) => <div key={item.id} className="rounded-lg border border-white/[0.06] p-3 text-xs"><p className="text-slate-200">{item.kind}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-emerald-200 underline">{item.url}</a>}{item.notes && <p className="mt-1 text-slate-400">{item.notes}</p>}</div>)}</div> : null}
                <button disabled={isWorking || !selectedOutcome?.evidence?.length} onClick={runVerification} className="mt-4 w-full rounded-xl bg-emerald-300 px-4 py-3 text-xs font-semibold text-[#07110d] disabled:opacity-40">{isWorking ? "Verifying…" : "Run AI verification"}</button>
                {selectedOutcome?.verification && <div className="mt-4 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] p-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-white">AI result: {selectedOutcome.verification.status}</p><p className="text-xs text-emerald-200">{Math.round(selectedOutcome.verification.confidence * 100)}% confidence</p></div><p className="mt-2 text-xs leading-5 text-slate-300">{selectedOutcome.verification.summary}</p>{selectedOutcome.verification.criteria.map((item, index) => <p key={index} className="mt-2 text-xs text-slate-400">{item.status} · {item.criterion} — {item.evidence}</p>)}{selectedOutcome.verification.status === "PASS" && <button disabled={isWorking} onClick={settleOutcome} className="mt-4 w-full rounded-xl bg-emerald-300 px-4 py-3 text-xs font-semibold text-[#07110d] disabled:opacity-40">Confirm & capture PayPal payment</button>}</div>}
                {selectedOutcome?.paypalAuthorizationId && selectedOutcome.status !== "PAID" && selectedOutcome.status !== "VOIDED" && <button disabled={isWorking} onClick={voidOutcome} className="mt-3 w-full rounded-xl border border-rose-300/20 px-4 py-3 text-xs text-rose-200 disabled:opacity-40">Void authorization</button>}
                {actionMessage && <p role="status" className="mt-3 text-xs leading-5 text-slate-300">{actionMessage}</p>}
              </div>
            </div>

            <div className="h-fit rounded-2xl border border-white/[0.07] bg-[#101719] p-5 sm:p-6">
              <h2 className="font-semibold text-white">Outcome summary</h2>
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                  <span className="text-sm text-slate-400">
                    Outcome value
                  </span>
                  <span className="font-semibold text-white">
                    {currency(selectedOutcome?.amount ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                  <span className="text-sm text-slate-400">Recipient</span>
                  <span className="max-w-[55%] truncate text-sm text-slate-200">
                    {selectedOutcome?.recipient ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                  <span className="text-sm text-slate-400">Due date</span>
                  <span className="text-sm text-slate-200">
                    {selectedOutcome?.dueDate ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-400">
                    Current status
                  </span>
                  {selectedOutcome && (
                    <StatusBadge status={selectedOutcome.status} />
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-white/[0.07] bg-[#0a1011] p-3">
                <p className="text-xs text-slate-300">Status is controlled by backend payment and verification events. It cannot be manually edited here.</p>
                {actionMessage && <p role="status" className="mt-2 text-xs text-emerald-200">{actionMessage}</p>}
              </div>

              <button
                onClick={() => navigateTo("Contracts")}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.04]"
              >
                View all contracts <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <SectionHeading
            eyebrow="Workspace overview"
            title="Pay for outcomes, not promises."
            description="Structure agreements, review evidence and coordinate conditional payments from one workspace."
          />
          <button
            onClick={() => navigateTo("Create Outcome")}
            className="mb-7 inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#07110d] transition hover:bg-emerald-200 sm:mb-7"
          >
            <Plus size={16} /> Create outcome
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total outcome value"
            value={currency(totalValue)}
            detail="Across persisted agreements"
            icon={CircleDollarSign}
          />
          <StatCard
            title="Awaiting resolution"
            value={String(pendingCount)}
            detail="Authorized, verifying or review"
            icon={Clock3}
          />
          <StatCard
            title="In payment workflow"
            value={currency(authorizedValue)}
            detail="Not necessarily captured"
            icon={Wallet}
          />
          <StatCard
            title="PayPal captured"
            value={currency(paidValue)}
            detail="Confirmed PayPal captures"
            icon={CheckCircle2}
          />
        </div>

        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101719]">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] p-5">
              <div>
                <h2 className="font-semibold text-white">
                  Recent outcomes
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Latest activity in your workspace
                </p>
              </div>
              <button
                onClick={() => navigateTo("Contracts")}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-200 hover:text-emerald-100"
              >
                View all <ArrowRight size={14} />
              </button>
            </div>
            <div className="h-[335px] w-full px-2 pb-3 sm:px-3">
              <AgGridReact<Outcome>
                theme={gridTheme}
                rowData={outcomes.slice(0, 5)}
                columnDefs={columnDefs}
                defaultColDef={{
                  resizable: true,
                  sortable: true,
                }}
                rowHeight={62}
                headerHeight={42}
                animateRows
                onRowClicked={(event) => {
                  if (event.data) {
                    setSelectedOutcomeId(event.data.id);
                    setActivePage("Contracts");
                  }
                }}
                overlayNoRowsTemplate="No outcomes yet."
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.07] bg-[#101719] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-300/10 p-2.5 text-emerald-200">
                  <ShieldCheck size={19} />
                </div>
                <div>
                  <h2 className="font-semibold text-white">
                    Verification pipeline
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Persisted workspace records
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {(
                  [
                    ["Authorized", "AUTHORIZED", "text-sky-300"],
                    ["Verifying", "VERIFYING", "text-amber-300"],
                    ["Human review", "REVIEW", "text-violet-300"],
                    ["Paid", "PAID", "text-emerald-300"],
                  ] as const
                ).map(([label, status, color]) => {
                  const count = outcomes.filter(
                    (outcome) => outcome.status === status
                  ).length;

                  return (
                    <div key={status}>
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="text-slate-400">{label}</span>
                        <span className={color}>{count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-current transition-all"
                          style={{
                            width: `${
                              outcomes.length
                                ? (count / outcomes.length) * 100
                                : 0
                            }%`,
                            color:
                              status === "AUTHORIZED"
                                ? "#7dd3fc"
                                : status === "VERIFYING"
                                  ? "#fcd34d"
                                  : status === "REVIEW"
                                    ? "#c4b5fd"
                                    : "#6ee7b7",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => navigateTo("Verification")}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.04]"
              >
                Open verification center <ArrowRight size={15} />
              </button>
            </div>

            <div className="rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[0.08] to-transparent p-5">
              <div className="flex items-center gap-2 text-emerald-200">
                <Sparkles size={17} />
                <span className="text-sm font-semibold">
                  Built around outcomes
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Define the work, agree on success criteria, submit evidence
                and make settlement decisions based on verification.
              </p>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                PayPal authorization, evidence evaluation and settlement are connected to the backend.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <main className="min-h-screen bg-[#090e0f] text-slate-100">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden w-[248px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0b1112] lg:flex">
          <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.07] px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-300 text-[#07110d]">
              <Activity size={20} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight text-white">
                OUTCOME<span className="text-emerald-300">.</span>
              </p>
              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-500">
                Conditional payments
              </p>
            </div>
          </div>

          <div className="px-4 pt-7">
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              Workspace
            </p>
            <nav className="space-y-1">
              {navigation.map(({ label, icon: Icon }) => {
                const active = activePage === label;

                return (
                  <button
                    key={label}
                    onClick={() => navigateTo(label)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                      active
                        ? "border border-emerald-300/10 bg-emerald-300/[0.08] text-emerald-200"
                        : "border border-transparent text-slate-400 hover:bg-white/[0.035] hover:text-white"
                    }`}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto p-4">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="flex items-center gap-2 text-slate-300">
                <LockKeyhole size={15} className="text-emerald-200" />
                <span className="text-xs font-medium">Sandbox workspace</span>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">
Sandbox payment workflow. PayPal captures require operator confirmation.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl px-2 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#182224] text-xs font-semibold text-emerald-200">
                OW
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200">
                  Demo workspace
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Operator confirmation required
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-white/[0.07] bg-[#090e0f]/90 px-4 backdrop-blur-xl sm:px-8 lg:px-10">
            <div className="flex items-center gap-3">
              <button
                aria-label="Open navigation"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden"
              >
                <Menu size={18} />
              </button>
              <div>
                <p className="text-sm font-medium text-white">{activePage}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Workspace / {activePage}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-white/[0.07] px-3 py-1.5 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                <span className="text-[10px] text-slate-400">
                  Demo mode
                </span>
              </div>
              <button
                aria-label="Notifications"
                title="Notifications"
                className="relative rounded-xl border border-white/[0.07] p-2.5 text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
              >
                <Bell size={17} />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-emerald-300" />
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-[10px] font-bold text-emerald-200">
                OW
              </div>
            </div>
          </header>

          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 lg:hidden">
              <div className="w-[280px] border-r border-white/10 bg-[#0b1112] p-5 shadow-2xl">
                <div className="mb-7 flex items-center justify-between">
                  <p className="font-bold tracking-tight text-white">
                    OUTCOME<span className="text-emerald-300">.</span>
                  </p>
                  <button
                    aria-label="Close navigation"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
                <nav className="space-y-1">
                  {navigation.map(({ label, icon: Icon }) => (
                    <button
                      key={label}
                      onClick={() => navigateTo(label)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${
                        activePage === label
                          ? "bg-emerald-300/10 text-emerald-200"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon size={17} />
                      {label}
                    </button>
                  ))}
                </nav>
              </div>
              <button
                aria-label="Close navigation overlay"
                className="absolute inset-0 -z-10 cursor-default"
                onClick={() => setMobileMenuOpen(false)}
              />
            </div>
          )}

          <div className="mx-auto max-w-[1500px] px-5 py-8 pb-28 sm:px-8 sm:py-8 sm:pb-8 lg:px-10">
            {pageContent()}

            <footer className="mt-10 border-t border-white/[0.07] py-5 text-center text-[10px] leading-5 text-slate-600 sm:text-left">
              OUTCOME V2 · Prototype workspace · Demo records are local and
              reset on refresh · Authentication and payment backend integration pending
            </footer>
          </div>

          {/* Mobile bottom navigation */}
          <nav
            aria-label="Mobile navigation"
            className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-[#090e0f]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"
          >
            {navigation.map(({ label, icon: Icon }) => {
              const active = activePage === label;

              const shortLabel: Record<PageName, string> = {
                Overview: "Overview",
                "Create Outcome": "Create",
                Contracts: "Contracts",
                Verification: "Verify",
              };

              return (
                <button
                  key={label}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => navigateTo(label)}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] transition ${
                    active
                      ? "bg-emerald-300/10 text-emerald-200"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Icon size={19} />
                  <span className="truncate">{shortLabel[label]}</span>
                </button>
              );
            })}
          </nav>
        </section>
      </div>
    </main>
  );
}
