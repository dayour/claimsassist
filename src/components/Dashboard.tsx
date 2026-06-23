import type { Claim, ClaimsFilter } from "../data/seed";
import { STATUSES, INCIDENT_TYPES } from "../data/seed";
import { usd } from "./ui";

const STATUS_COLOR: Record<string, string> = {
  New: "var(--new)",
  "Under Review": "var(--review)",
  Classified: "var(--classified)",
  Approved: "var(--approved)",
  Denied: "var(--denied)",
  Closed: "var(--closed)",
};

export default function Dashboard({
  claims,
  onDrill,
}: {
  claims: Claim[];
  onDrill: (f: ClaimsFilter) => void;
}) {
  const total = claims.length;
  const open = claims.filter((c) => !["Closed", "Denied"].includes(c.status)).length;
  const reserve = claims.reduce((s, c) => s + c.reserveUsd, 0);
  const classified = claims.filter((c) => c.classification).length;
  const clsRate = total ? Math.round((classified / total) * 100) : 0;

  const byStatus = STATUSES.map((s) => ({ s, n: claims.filter((c) => c.status === s).length })).filter((x) => x.n);
  const maxStatus = Math.max(1, ...byStatus.map((x) => x.n));

  const byType = INCIDENT_TYPES.map((t) => ({ t, n: claims.filter((c) => c.incidentType === t).length }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n);
  const maxType = Math.max(1, ...byType.map((x) => x.n));

  const recent = [...claims].sort((a, b) => b.dateReported.localeCompare(a.dateReported)).slice(0, 5);

  return (
    <div>
      <div className="grid stats">
        <div className="card stat click" onClick={() => onDrill({})} title="View all claims">
          <div className="k">Total Claims</div>
          <div className="v">{total}</div>
          <div className="d">across 4 regions</div>
        </div>
        <div className="card stat click" onClick={() => onDrill({ openActive: true })} title="View open / active claims">
          <div className="k">Open / Active</div>
          <div className="v" style={{ color: "var(--review)" }}>{open}</div>
          <div className="d">awaiting review or decision</div>
        </div>
        <div className="card stat click" onClick={() => onDrill({})} title="View all claims">
          <div className="k">Total Reserve</div>
          <div className="v"><small>$</small>{(reserve / 1000).toFixed(1)}<small>k</small></div>
          <div className="d">{usd(reserve)} provisioned</div>
        </div>
        <div className="card stat click" onClick={() => onDrill({ classifiedOnly: true })} title="View classified claims">
          <div className="k">AI Classified</div>
          <div className="v" style={{ color: "var(--bronze-dim)" }}>{clsRate}<small>%</small></div>
          <div className="d">{classified} of {total} via incident classifier</div>
        </div>
      </div>

      <div className="grid two-col section">
        <div className="card cardpad">
          <h3>Recent Claims</h3>
          <table className="claims" style={{ margin: "-6px -4px" }}>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id} className="click" onClick={() => onDrill({ q: c.claimNumber })}>
                  <td className="cn" style={{ width: 130 }}>{c.claimNumber}</td>
                  <td>{c.claimant}<div className="who">{c.region}</div></td>
                  <td>{c.incidentType}</td>
                  <td className="usd" style={{ textAlign: "right" }}>{usd(c.reserveUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card cardpad">
          <h3>Status Breakdown</h3>
          {byStatus.map(({ s, n }) => (
            <div className="bar-row click" key={s} onClick={() => onDrill({ status: s })} title={`View ${s} claims`}>
              <span className="lab">{s}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${(n / maxStatus) * 100}%`, background: STATUS_COLOR[s] }} />
              </span>
              <span className="num">{n}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="card cardpad">
          <h3>Incident Type Distribution</h3>
          {byType.map(({ t, n }) => (
            <div className="bar-row click" key={t} onClick={() => onDrill({ incidentType: t })} title={`View ${t} claims`}>
              <span className="lab" style={{ width: 180 }}>{t}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${(n / maxType) * 100}%`, background: "linear-gradient(90deg, var(--bronze), var(--bronze-dim))" }} />
              </span>
              <span className="num">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
