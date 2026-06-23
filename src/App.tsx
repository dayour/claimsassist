import { useEffect, useMemo, useState } from "react";
import { claims as seedClaims, type Claim, type ClaimsFilter } from "./data/seed";
import Dashboard from "./components/Dashboard";
import Claims from "./components/Claims";
import ReportIncident from "./components/ReportIncident";
import Classifier from "./components/Classifier";
import ClaimWorkspace from "./components/ClaimWorkspace";
import Department from "./components/Department";
import SettingsWidget from "./components/SettingsWidget";
import { useTheme } from "./lib/theme";
import {
  loadClaims,
  createClaim,
  getConnectionInfo,
  type ConnectionInfo,
  type CreateResult,
} from "./lib/dataverse";
import { dataverseTableUrl } from "./lib/dataverseSchema";

type View = "dashboard" | "claims" | "report" | "classifier" | "department" | "workspace";

const NAV: { id: View; label: string; ico: string; crumb: string }[] = [
  { id: "dashboard", label: "Dashboard", ico: "◳", crumb: "Overview" },
  { id: "claims", label: "Claims", ico: "▤", crumb: "All claims" },
  { id: "report", label: "Report Incident", ico: "＋", crumb: "New incident intake" },
  { id: "classifier", label: "Incident Classifier", ico: "◆", crumb: "AI classification" },
  { id: "department", label: "Department", ico: "☷", crumb: "Tasks & calendar" },
];

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [claims, setClaims] = useState<Claim[]>(seedClaims);
  const [source, setSource] = useState<"loading" | "dataverse" | "seed">("loading");
  const [rowCount, setRowCount] = useState<number>(0);
  const [dvError, setDvError] = useState<string>("");
  const [conn, setConn] = useState<ConnectionInfo | null>(null);
  const [claimsFilter, setClaimsFilter] = useState<ClaimsFilter>({});
  const [wsClaim, setWsClaim] = useState<Claim | null>(null);
  const [theme, setTheme] = useTheme();

  const existingNumbers = useMemo(() => claims.map((c) => c.claimNumber), [claims]);
  const CRUMBS: Record<string, { label: string; crumb: string }> = {
    workspace: { label: "Case Workspace", crumb: wsClaim?.claimNumber ?? "Workspace" },
  };
  const active = NAV.find((n) => n.id === view) ?? { label: CRUMBS[view]?.label ?? "", crumb: CRUMBS[view]?.crumb ?? "" };

  function openWorkspace(c: Claim) {
    setWsClaim(c);
    setView("workspace");
  }

  function applyLoad(res: Awaited<ReturnType<typeof loadClaims>>) {
    setClaims(res.claims);
    setSource(res.source);
    setRowCount(res.rowCount);
    setDvError(res.error ?? "");
    if (res.error) console.info("[OWCP] data source fallback:", res.error);
  }

  function refresh() {
    setSource("loading");
    loadClaims().then(applyLoad);
  }

  useEffect(() => {
    let alive = true;
    loadClaims().then((res) => {
      if (alive) applyLoad(res);
    });
    getConnectionInfo().then((info) => {
      if (alive) setConn(info);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Drill-through from the Dashboard into a filtered Claims view.
  function drill(filter: ClaimsFilter) {
    setClaimsFilter({ ...filter });
    setView("claims");
  }

  // Persist a new claim. When the connection is live, write to Dataverse and
  // only confirm success after the row is accepted, then reload the canonical
  // list. Downstream email/notification is handled by the Dataverse workflow
  // triggered from the saved row.
  async function addClaim(c: Claim): Promise<CreateResult> {
    if (source === "dataverse") {
      const res = await createClaim(c);
      if (res.ok) {
        const reloaded = await loadClaims();
        applyLoad(reloaded);
      }
      return res;
    }
    // Seed / offline: optimistic local insert, deduped by claim number.
    setClaims((prev) => [c, ...prev.filter((p) => p.claimNumber !== c.claimNumber)]);
    return { ok: true };
  }

  const connectionLoaded = conn !== null;
  const envLabel = conn?.orgName || conn?.environmentId || (connectionLoaded ? "Power Apps host unavailable" : "Loading environment");
  // Prefer a friendly tenant domain (from the signed-in UPN) over the raw GUID.
  const tenantLabel = conn?.user?.includes("@")
    ? conn.user.split("@")[1]
    : conn?.tenantId || (connectionLoaded ? "Tenant unavailable" : "Loading tenant");
  const userLabel = conn?.user || (connectionLoaded ? "Power Apps user unavailable" : "Loading user");

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <div className="logo">
            <span className="mark">OW</span>
            Claim_Studio
          </div>
          <div className="sub">Workers' Comp Claims</div>
        </div>
        <div className="nav">
          {NAV.map((n) => (
            <button key={n.id} className={view === n.id ? "active" : ""} onClick={() => setView(n.id)}>
              <span className="ico">{n.ico}</span> {n.label}
            </button>
          ))}
        </div>
        <SettingsWidget
          envLabel={envLabel}
          tenantLabel={tenantLabel}
          userLabel={userLabel}
          orgUrl={conn?.orgUrl}
          environmentId={conn?.environmentId}
          source={source}
          rowCount={rowCount}
          dvError={dvError}
          connectionError={conn?.hostError || conn?.dataverseError}
          dataverseUrl={dataverseTableUrl(conn?.orgUrl, conn?.environmentId) ?? undefined}
          onRefresh={refresh}
          theme={theme}
          onTheme={setTheme}
        />
      </nav>

      <main className="main">
        <div className="topbar">
          <div>
            <h1>{active.label}</h1>
            <div className="crumb">Claim_Studio · {active.crumb}</div>
          </div>
          <div className="user">
            {userLabel}
            <span className="avatar">{(userLabel || "?").slice(0, 2).toUpperCase()}</span>
          </div>
        </div>
        <div className="content">
          {view === "dashboard" && <Dashboard claims={claims} onDrill={drill} />}
          {view === "claims" && (
            <Claims
              claims={claims}
              filter={claimsFilter}
              source={source}
              onRefresh={refresh}
              dataverseUrl={dataverseTableUrl(conn?.orgUrl, conn?.environmentId) ?? undefined}
              orgUrl={conn?.orgUrl}
              onOpenWorkspace={openWorkspace}
            />
          )}
          {view === "report" && <ReportIncident existingNumbers={existingNumbers} onCreate={addClaim} />}
          {view === "classifier" && <Classifier />}
          {view === "department" && <Department user={conn?.user || ""} />}
          {view === "workspace" && wsClaim && (
            <ClaimWorkspace
              claim={wsClaim}
              user={conn?.user || ""}
              onBack={() => setView("claims")}
              onChanged={refresh}
            />
          )}
        </div>
      </main>
    </div>
  );
}
