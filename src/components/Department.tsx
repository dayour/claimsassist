import { useEffect, useMemo, useState } from "react";
import type { CaseTask, CaseAppointment, TaskStatus } from "../data/seed";
import { loadAllTasks, loadAllAppointments, updateTask } from "../lib/dataverse";
import { fmtDate } from "./ui";

type TaskFilter = "me" | "all" | "overdue";

const today = () => new Date().toISOString().slice(0, 10);
function isOverdue(t: CaseTask): boolean {
  return t.status !== "Completed" && !!t.dueDate && t.dueDate < today();
}
function fmtDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function Department({ user }: { user: string }) {
  const [view, setView] = useState<"tasks" | "calendar">("tasks");
  const [tasks, setTasks] = useState<CaseTask[] | null>(null);
  const [appts, setAppts] = useState<CaseAppointment[] | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [t, a] = await Promise.all([loadAllTasks(), loadAllAppointments()]);
    setTasks(t); setAppts(a);
  }
  useEffect(() => { refresh(); }, []);

  const me = (user || "").split("@")[0].toLowerCase();
  const filtered = useMemo(() => {
    const list = tasks ?? [];
    if (filter === "overdue") return list.filter(isOverdue);
    if (filter === "me") return list.filter((t) => (t.assignedTo || "").toLowerCase().includes(me) || (t.assignedTo || "").toLowerCase() === (user || "").toLowerCase());
    return list;
  }, [tasks, filter, me, user]);

  const counts = useMemo(() => ({
    me: (tasks ?? []).filter((t) => (t.assignedTo || "").toLowerCase().includes(me)).length,
    all: (tasks ?? []).length,
    overdue: (tasks ?? []).filter(isOverdue).length,
  }), [tasks, me]);

  async function complete(t: CaseTask) {
    setBusy(true);
    try { await updateTask(t.id, { status: "Completed" }); await refresh(); } finally { setBusy(false); }
  }
  async function setStatus(t: CaseTask, status: TaskStatus) {
    setBusy(true);
    try { await updateTask(t.id, { status }); await refresh(); } finally { setBusy(false); }
  }

  // Group appointments by day for the calendar view.
  const byDay = useMemo(() => {
    const m = new Map<string, CaseAppointment[]>();
    for (const a of (appts ?? []).filter((a) => a.start)) {
      const key = a.start.slice(0, 10);
      (m.get(key) ?? m.set(key, []).get(key)!).push(a);
    }
    return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0]));
  }, [appts]);

  return (
    <div>
      <div className="toolbar">
        <button className={`btn ghost${view === "tasks" ? " toggle-on" : ""}`} onClick={() => setView("tasks")}>Tasks</button>
        <button className={`btn ghost${view === "calendar" ? " toggle-on" : ""}`} onClick={() => setView("calendar")}>Calendar</button>
        <span className="spacer" />
        <button className="btn ghost" onClick={refresh} title="Reload">↻</button>
      </div>

      {view === "tasks" && (
        <>
          <div className="toolbar" style={{ marginTop: 0 }}>
            <button className={`btn ghost${filter === "me" ? " toggle-on" : ""}`} onClick={() => setFilter("me")}>Assigned to Me ({counts.me})</button>
            <button className={`btn ghost${filter === "all" ? " toggle-on" : ""}`} onClick={() => setFilter("all")}>Department Tasks ({counts.all})</button>
            <button className={`btn ghost${filter === "overdue" ? " toggle-on" : ""}`} onClick={() => setFilter("overdue")}>Overdue ({counts.overdue})</button>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="claims">
              <thead><tr><th>Task</th><th>Claim</th><th>Assigned To</th><th>Due</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {filtered.map((t) => {
                  const od = isOverdue(t);
                  return (
                    <tr key={t.id}>
                      <td><strong style={{ textDecoration: t.status === "Completed" ? "line-through" : "none" }}>{t.title}</strong></td>
                      <td className="who">{t.claimNumber || "—"}</td>
                      <td>{t.assignedTo || "Unassigned"}</td>
                      <td className="who">{t.dueDate ? fmtDate(t.dueDate) : "—"}</td>
                      <td><span className={`badge${od ? " overdue" : ""}`}>{od ? "Overdue" : t.status}</span></td>
                      <td style={{ textAlign: "right" }}>
                        {t.status === "Open" && <button className="btn ghost" disabled={busy} onClick={() => setStatus(t, "In Progress")}>Start</button>}
                        {t.status !== "Completed" && <button className="btn ghost" disabled={busy} onClick={() => complete(t)} style={{ marginLeft: 6 }}>Complete</button>}
                      </td>
                    </tr>
                  );
                })}
                {tasks && filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>No tasks.</td></tr>}
                {!tasks && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>Loading…</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === "calendar" && (
        <div className="card cardpad">
          <h3>Department Calendar</h3>
          {!appts ? <div className="result-empty">Loading…</div> : byDay.length === 0 ? <div className="result-empty">No appointments scheduled.</div> :
            byDay.map(([day, items]) => (
              <div key={day} className="cal-day">
                <div className="cal-date">{fmtDate(day)}</div>
                <div>
                  {items.map((a) => (
                    <div key={a.id} className="cal-event">
                      <strong>{a.subject}</strong>
                      <span className="who">{fmtDateTime(a.start)}{a.location ? ` · ${a.location}` : ""}{a.claimNumber ? ` · ${a.claimNumber}` : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
