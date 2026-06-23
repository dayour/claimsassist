import type { Claim } from "../data/seed";
import { SeverityTag, fmtDate } from "./ui";

// Rich Adaptive-Card style render of a claim + its classification.
// Used for the Report Incident preview (full record preview before filing).
export function ClaimAdaptiveCard({ claim, heading }: { claim: Claim; heading?: string }) {
  const c = claim;
  const facts: [string, string][] = [
    ["Claimant", c.claimant || "—"],
    ["Region", c.region],
    ["Department", c.department],
    ["Body Part", c.bodyPart || "—"],
    ["Date of Injury", c.dateOfInjury ? fmtDate(c.dateOfInjury) : "—"],
    ["Adjuster", c.adjuster],
  ];
  return (
    <div className="acard">
      <div className="acard-head">
        <div className="acard-title">
          <span className="acard-icon">◆</span>
          <div>
            <div className="acard-h1">{c.incidentType}</div>
            <div className="acard-sub">{heading ?? "Incident Classification"}</div>
          </div>
        </div>
        <SeverityTag severity={c.severity} />
      </div>
      <div className="acard-body">
        <div className="factset">
          {facts.map(([k, v]) => (
            <div className="fact" key={k}>
              <span>{k}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
        {c.description && <div className="acard-desc">{c.description}</div>}
        {c.classification && (
          <div className="acard-action">
            <div className="acard-action-label">Recommended Action</div>
            <div className="acard-action-text">{c.classification.recommendedAction}</div>
            <div className="acard-rationale">{c.classification.rationale}</div>
          </div>
        )}
      </div>
      <div className="acard-foot">
        <span className="acard-model">{c.classification?.model ?? "GPT-4.1 mini"}</span>
        <span className="acard-foot-note">Copilot Studio incident classifier</span>
      </div>
    </div>
  );
}
