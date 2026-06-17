import { useState } from "react";
import type { Claim } from "../data/seed";
import { PROPERTIES, DEPARTMENTS, ADJUSTERS } from "../data/seed";
import { classifyIncident, nextClaimNumber } from "../lib/classifier";
import { ClaimAdaptiveCard } from "./ClassificationCard";

const MIN_DESC = 12;

export default function ReportIncident({
  existingNumbers,
  onCreate,
}: {
  existingNumbers: string[];
  onCreate: (c: Claim) => Promise<{ ok: boolean; error?: string; warning?: string }>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [claimant, setClaimant] = useState("");
  const [property, setProperty] = useState<string>(PROPERTIES[0]);
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0]);
  const [adjuster, setAdjuster] = useState<string>(ADJUSTERS[0]);
  const [doi, setDoi] = useState(today);
  const [bodyPart, setBodyPart] = useState("");
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<Claim | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const trimmedDesc = description.trim();
  const claimantOk = claimant.trim().length > 0;
  const descOk = trimmedDesc.length >= MIN_DESC;
  const canSubmit = claimantOk && descOk && !saving;

  // Explain why File Claim is unavailable so the button is never silently dead.
  const blockReason = saving
    ? null
    : !claimantOk
    ? "Enter the claimant's name to file."
    : !descOk
    ? `Add a bit more detail — ${MIN_DESC - trimmedDesc.length} more character${
        MIN_DESC - trimmedDesc.length === 1 ? "" : "s"
      } needed for classification.`
    : null;

  function buildClaim(): Claim {
    const cls = classifyIncident(trimmedDesc);
    return {
      id: "c-" + Math.random().toString(36).slice(2, 8),
      claimNumber: nextClaimNumber(existingNumbers),
      claimant: claimant.trim(),
      property,
      department,
      dateOfInjury: doi,
      dateReported: today,
      incidentType: cls.category,
      bodyPart: bodyPart.trim() || "Unspecified",
      status: "Classified",
      severity: cls.severity,
      adjuster,
      reserveUsd: 0,
      description: trimmedDesc,
      classification: cls,
    };
  }

  function runPreview() {
    if (!trimmedDesc) return;
    setPreview(buildClaim());
  }

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setDone(null);
    setWarn(null);
    const claim = buildClaim();
    try {
      const res = await onCreate(claim);
      if (res.ok) {
        setDone(claim.claimNumber);
        setWarn(res.warning ?? null);
        setClaimant("");
        setBodyPart("");
        setDescription("");
        setPreview(null);
      } else {
        setError(res.error || "The claim could not be saved to Dataverse.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 880 }}>
      {done && (
        <div className="banner">✓ Claim {done} filed and auto-classified.{!warn && " A PDF summary was saved to the claim record and emailed to you."}</div>
      )}
      {warn && (
        <div className="banner" style={{ background: "var(--review, #6b5300)", color: "#fff" }}>⚠ {warn}</div>
      )}
      {error && (
        <div className="banner" style={{ background: "var(--sev-high, #5b1d1d)", color: "#fff" }}>
          ⚠ {error}
        </div>
      )}
      <div className="card cardpad">
        <h3>Report a Workplace Incident</h3>
        <div className="form-grid">
          <div className="field">
            <label>Claimant Name</label>
            <input className="input" value={claimant} onChange={(e) => setClaimant(e.target.value)} placeholder="Full name of injured employee" />
          </div>
          <div className="field">
            <label>Date of Injury</label>
            <input className="input" type="date" value={doi} max={today} onChange={(e) => setDoi(e.target.value)} />
          </div>
          <div className="field">
            <label>Property</label>
            <select className="select" value={property} onChange={(e) => setProperty(e.target.value)}>
              {PROPERTIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Department</label>
            <select className="select" value={department} onChange={(e) => setDepartment(e.target.value)}>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Body Part Affected</label>
            <input className="input" value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} placeholder="e.g. Lower back, Right wrist" />
          </div>
          <div className="field">
            <label>Assigned Adjuster</label>
            <select className="select" value={adjuster} onChange={(e) => setAdjuster(e.target.value)}>
              {ADJUSTERS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div className="field full">
            <label>What happened?</label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setPreview(null); }}
              placeholder="Describe the incident — mechanism, location, and injury. The incident classifier reads this to assign a category and severity."
            />
          </div>
        </div>

        {preview && (
          <div style={{ marginTop: 18 }}>
            <ClaimAdaptiveCard claim={preview} heading="Classifier Preview — record to be filed" />
          </div>
        )}

        <div className="actions">
          <button className="btn" disabled={!canSubmit} onClick={submit}>
            {saving ? "Filing…" : "File Claim"}
          </button>
          <button className="btn ghost" disabled={!trimmedDesc || saving} onClick={runPreview}>Preview Classification</button>
          <span style={{ color: blockReason ? "var(--review)" : "var(--muted)", fontSize: 12.5 }}>
            {blockReason ?? "New claims are routed through the Copilot Studio classifier on intake."}
          </span>
        </div>
      </div>
    </div>
  );
}
