import type { ClaimStatus, Severity } from "../data/seed";

const STATUS_CLASS: Record<ClaimStatus, string> = {
  New: "new",
  "Under Review": "review",
  Classified: "classified",
  Approved: "approved",
  Denied: "denied",
  Closed: "closed",
};

export function StatusPill({ status }: { status: ClaimStatus }) {
  return (
    <span className={`pill ${STATUS_CLASS[status]}`}>
      <span className="pdot" />
      {status}
    </span>
  );
}

export function SeverityTag({ severity }: { severity: Severity }) {
  return (
    <span className={`sev ${severity.toLowerCase()}`}>
      <span className="sdot" />
      {severity}
    </span>
  );
}

export function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const STAGE_CLASS: Record<string, string> = {
  "Partial Intake": "new",
  "Ready to Submit": "review",
  "Submitted to Sedgwick": "classified",
  "Adjustment": "review",
  "Case Management": "approved",
  "Completed": "closed",
};

export function StageBadge({ stage }: { stage?: string }) {
  if (!stage) return null;
  return (
    <span className={`pill ${STAGE_CLASS[stage] ?? "review"}`}>
      <span className="pdot" />
      {stage}
    </span>
  );
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
