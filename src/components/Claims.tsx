import { useEffect, useMemo, useState } from "react";
import type { Claim, ClaimsFilter } from "../data/seed";
import { STATUSES, PROPERTIES } from "../data/seed";
import { StatusPill, SeverityTag, usd, fmtDate } from "./ui";

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Deep link to the specific record in the Workers' Comp Cases model-driven app.
function recordUrl(claim: Claim, orgUrl?: string): string | null {
  if (!orgUrl || !GUID_RE.test(claim.id)) return null;
  const base = orgUrl.replace(/\/$/, "");
  return `${base}/main.aspx?appname=dystudio_wccases&pagetype=entityrecord&etn=owcp_claim&id=${claim.id}`;
}

function ClaimDrawer({ claim, onClose, orgUrl, onOpenWorkspace }: { claim: Claim; onClose: () => void; orgUrl?: string; onOpenWorkspace?: (c: Claim) => void }) {
  const c = claim;
  const recUrl = recordUrl(c, orgUrl);
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer">
        <header>
          <div>
            <div className="cn">{c.claimNumber}</div>
            <div style={{ marginTop: 8 }}><StatusPill status={c.status} /></div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {onOpenWorkspace && (
                <button
                  className="btn"
                  onClick={() => onOpenWorkspace(c)}
                  style={{ fontSize: 12.5 }}
                >
                  ▦ Open Workspace
                </button>
              )}
              {recUrl && (
                <a
                  className="btn ghost"
                  href={recUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open this record in Dataverse"
                  style={{ display: "inline-flex", textDecoration: "none", fontSize: 12.5 }}
                >
                  ⧉ View in Dataverse
                </a>
              )}
            </div>
          </div>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="body">
          <div className="kv">
            <span className="k">Claimant</span><span className="v">{c.claimant}</span>
            <span className="k">Property</span><span className="v">{c.property}</span>
            <span className="k">Department</span><span className="v">{c.department}</span>
            <span className="k">Incident Type</span><span className="v">{c.incidentType}</span>
            <span className="k">Body Part</span><span className="v">{c.bodyPart}</span>
            <span className="k">Severity</span><span className="v"><SeverityTag severity={c.severity} /></span>
            <span className="k">Date of Injury</span><span className="v">{fmtDate(c.dateOfInjury)}</span>
            <span className="k">Date Reported</span><span className="v">{fmtDate(c.dateReported)}</span>
            <span className="k">Adjuster</span><span className="v">{c.adjuster}</span>
            <span className="k">Reserve</span><span className="v usd">{usd(c.reserveUsd)}</span>
          </div>

          <div style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 6 }}>Incident Description</div>
          <div className="descbox">{c.description}</div>

          {c.classification ? (
            <div className="ai-card">
              <div className="ai-head">
                <span>◆</span> Incident Classifier
                <span className="badge">{c.classification.model}</span>
              </div>
              <div className="ai-body">
                <div className="result-row"><span className="k">Category</span><strong>{c.classification.category}</strong></div>
                <div className="result-row" style={{ borderBottom: "none" }}>
                  <span className="k">Severity</span><SeverityTag severity={c.classification.severity} />
                </div>
                <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--muted)" }}>Recommended Action</div>
                <div style={{ fontSize: 13.5, marginTop: 3 }}>{c.classification.recommendedAction}</div>
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>{c.classification.rationale}</div>
              </div>
            </div>
          ) : (
            <div className="ai-card">
              <div className="ai-head"><span>◆</span> Incident Classifier <span className="badge">pending</span></div>
              <div className="ai-body" style={{ color: "var(--muted)", fontSize: 13 }}>
                Not yet classified. New claims are auto-classified on intake via the Copilot Studio workflow.
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default function Claims({
  claims,
  filter,
  source,
  onRefresh,
  dataverseUrl,
  orgUrl,
  onOpenWorkspace,
}: {
  claims: Claim[];
  filter?: ClaimsFilter;
  source?: "loading" | "dataverse" | "seed";
  onRefresh?: () => void;
  dataverseUrl?: string;
  orgUrl?: string;
  onOpenWorkspace?: (c: Claim) => void;
}) {
  const [q, setQ] = useState(filter?.q ?? "");
  const [status, setStatus] = useState<string>(filter?.status ?? "");
  const [property, setProperty] = useState<string>(filter?.property ?? "");
  const [openActive, setOpenActive] = useState(!!filter?.openActive);
  const [classifiedOnly, setClassifiedOnly] = useState(!!filter?.classifiedOnly);
  const [incidentType, setIncidentType] = useState<string>(filter?.incidentType ?? "");
  const [open, setOpen] = useState<Claim | null>(null);

  // Apply an incoming drill-through filter whenever it changes.
  useEffect(() => {
    if (!filter) return;
    setQ(filter.q ?? "");
    setStatus(filter.status ?? "");
    setProperty(filter.property ?? "");
    setIncidentType(filter.incidentType ?? "");
    setOpenActive(!!filter.openActive);
    setClassifiedOnly(!!filter.classifiedOnly);
  }, [filter]);

  function clearFilters() {
    setQ(""); setStatus(""); setProperty(""); setIncidentType("");
    setOpenActive(false); setClassifiedOnly(false);
  }
  const anyFilter = q || status || property || incidentType || openActive || classifiedOnly;

  const rows = useMemo(() => {
    return claims.filter((c) => {
      if (status && c.status !== status) return false;
      if (property && c.property !== property) return false;
      if (incidentType && c.incidentType !== incidentType) return false;
      if (openActive && ["Closed", "Denied"].includes(c.status)) return false;
      if (classifiedOnly && !c.classification) return false;
      if (q) {
        const t = `${c.claimNumber} ${c.claimant} ${c.incidentType} ${c.department} ${c.adjuster}`.toLowerCase();
        if (!t.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [claims, q, status, property, incidentType, openActive, classifiedOnly]);

  return (
    <div>
      <div className="toolbar">
        <input className="input search" placeholder="Search claims, claimants, adjusters…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="select" value={property} onChange={(e) => setProperty(e.target.value)}>
          <option value="">All properties</option>
          {PROPERTIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <button
          className={`btn ghost${openActive ? " toggle-on" : ""}`}
          onClick={() => setOpenActive((v) => !v)}
          title="Show only open / active claims"
        >
          Open / Active
        </button>
        {anyFilter && <button className="btn ghost" onClick={clearFilters}>Clear</button>}
        <span className="spacer" />
        {source && (
          <span className={`srcbadge ${source}`}>
            {source === "dataverse" && "● Dataverse"}
            {source === "seed" && "● Sample data"}
            {source === "loading" && "● Connecting…"}
          </span>
        )}
        {onRefresh && <button className="btn ghost" onClick={onRefresh} title="Reload from Dataverse">↻</button>}
        {dataverseUrl && (
          <a
            className="btn ghost"
            href={dataverseUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the owcp_claim table in Power Apps"
            style={{ textDecoration: "none" }}
          >
            ⧉ View in Dataverse
          </a>
        )}
        <span style={{ color: "var(--muted)", fontSize: 13 }}>{rows.length} of {claims.length}</span>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <table className="claims">
          <thead>
            <tr>
              <th>Claim #</th><th>Claimant</th><th>Incident</th><th>Property</th>
              <th>Severity</th><th>Status</th><th>Adjuster</th><th style={{ textAlign: "right" }}>Reserve</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="click" onClick={() => setOpen(c)}>
                <td className="cn">{c.claimNumber}</td>
                <td>{c.claimant}<div className="who">{c.department}</div></td>
                <td>{c.incidentType}<div className="who">{c.bodyPart}</div></td>
                <td>{c.property}</td>
                <td><SeverityTag severity={c.severity} /></td>
                <td><StatusPill status={c.status} /></td>
                <td className="who" style={{ color: "var(--ink)" }}>{c.adjuster}</td>
                <td className="usd" style={{ textAlign: "right" }}>{usd(c.reserveUsd)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>No claims match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && <ClaimDrawer claim={open} onClose={() => setOpen(null)} orgUrl={orgUrl} onOpenWorkspace={onOpenWorkspace ? (c) => { setOpen(null); onOpenWorkspace(c); } : undefined} />}
    </div>
  );
}
