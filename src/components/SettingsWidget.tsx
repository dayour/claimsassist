import { useEffect, useRef, useState } from "react";
import { THEMES } from "../lib/theme";

interface Props {
  envLabel: string;
  tenantLabel: string;
  userLabel: string;
  orgUrl?: string;
  environmentId?: string;
  source: "loading" | "dataverse" | "seed";
  rowCount: number;
  dvError?: string;
  connectionError?: string;
  dataverseUrl?: string;
  onRefresh: () => void;
  theme: string;
  onTheme: (id: string) => void;
}

function SourceStatus({ source, rowCount }: { source: Props["source"]; rowCount: number }) {
  if (source === "loading") return <span><span className="dot loading">●</span> Connecting…</span>;
  if (source === "dataverse") return <span><span className="dot">●</span> Dataverse (live · {rowCount} rows)</span>;
  return <span><span className="dot seed">●</span> Sample data</span>;
}

export default function SettingsWidget({
  envLabel, tenantLabel, userLabel, orgUrl, environmentId,
  source, rowCount, dvError, connectionError, dataverseUrl, onRefresh, theme, onTheme,
}: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on Escape and return focus to the trigger.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const dvHost = orgUrl ? orgUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") : "—";
  const initials = (userLabel && userLabel !== "—" ? userLabel : "?").slice(0, 2).toUpperCase();
  const envText = envLabel || "—";

  return (
    <div className="settings">
      {open && (
        <>
          <div className="settings-backdrop" onClick={() => setOpen(false)} />
          <div className="settings-panel" role="dialog" aria-label="Profile and settings" id="settings-panel">
            <div className="sp-sec">
              <div className="sp-sec-title">Profile</div>
              <div className="sp-row">
                <div className="sp-lbl">Signed in</div>
                <div className="sp-val">{userLabel}</div>
              </div>
              <div className="sp-row">
                <div className="sp-lbl">Tenant</div>
                <div className="sp-val">{tenantLabel}</div>
              </div>
            </div>

            <div className="sp-sec">
              <div className="sp-sec-title">Appearance</div>
              <div className="sp-swatches">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    className={"sp-swatch" + (theme === t.id ? " active" : "")}
                    onClick={() => onTheme(t.id)}
                    aria-pressed={theme === t.id}
                    title={t.name}
                  >
                    <span
                      className="chip"
                      style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 0%, ${t.swatch[0]} 55%, ${t.swatch[1]} 55%, ${t.swatch[1]} 100%)` }}
                    />
                    <span className="nm">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sp-sec">
              <div className="sp-sec-title">Environment · Admin</div>
              <div className="sp-row">
                <div className="sp-lbl">Environment</div>
                <div className="sp-val"><span className="dot">●</span> {envLabel}</div>
              </div>
              <div className="sp-row">
                <div className="sp-lbl">Dataverse</div>
                <div className="sp-val" title={orgUrl}>{dvHost}</div>
              </div>
              <div className="sp-row">
                <div className="sp-lbl">Data Source</div>
                <div className="sp-val"><SourceStatus source={source} rowCount={rowCount} /></div>
              </div>
              {environmentId && (
                <div className="sp-row">
                  <div className="sp-lbl">Environment ID</div>
                  <div className="sp-val" style={{ fontSize: 11 }}>{environmentId}</div>
                </div>
              )}
              <div className="sp-actions">
                <button className="sp-btn" onClick={() => { onRefresh(); }}>Refresh</button>
                {dataverseUrl && (
                  <button className="sp-btn primary" onClick={() => window.open(dataverseUrl, "_blank")}>View in Dataverse</button>
                )}
              </div>
              {source === "seed" && dvError && <div className="sp-err">{dvError.slice(0, 180)}</div>}
              {connectionError && <div className="sp-err">{connectionError.slice(0, 220)}</div>}
            </div>
          </div>
        </>
      )}

      <button
        ref={triggerRef}
        className="settings-tile"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="settings-panel"
      >
        <span className="settings-avatar">{initials}</span>
        <span className="st-id">
          <span className="st-name" title={userLabel}>{userLabel}</span>
          <span className="st-env" title={envText}>{envText}</span>
          <span className="st-status"><SourceStatus source={source} rowCount={rowCount} /></span>
        </span>
        <span className="st-gear" aria-hidden="true">⚙</span>
      </button>
    </div>
  );
}
