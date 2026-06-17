import { useEffect, useState } from "react";
import type { Claim, Workspace as Ws, CaseStage, TaskStatus, DocType } from "../data/seed";
import { STAGES, DOC_TYPES } from "../data/seed";
import {
  loadWorkspace, addNote, addDocument, addAppointment, addTask, updateTask,
  updateClaimStage, updateClaimDocs,
} from "../lib/dataverse";
import { StageBadge, SeverityTag, StatusPill, usd, fmtDate } from "./ui";

type Tab = "overview" | "notes" | "documents" | "appointments" | "tasks";

function fmtDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ClaimWorkspace({
  claim, user, onBack, onChanged,
}: {
  claim: Claim;
  user: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [ws, setWs] = useState<Ws | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>(claim.stage ?? "Partial Intake");
  const [c1, setC1] = useState<boolean>(!!claim.c1Received);
  const [c4, setC4] = useState<boolean>(!!claim.c4Received);

  async function refresh() {
    if (!/^[0-9a-f-]{36}$/i.test(claim.id)) { setWs({ notes: [], documents: [], appointments: [], tasks: [] }); return; }
    setWs(await loadWorkspace(claim.id));
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [claim.id]);

  const live = /^[0-9a-f-]{36}$/i.test(claim.id);

  async function withBusy(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); await refresh(); onChanged(); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="toolbar">
        <button className="btn ghost" onClick={onBack}>← Claims</button>
        <span className="cn" style={{ fontSize: 16 }}>{claim.claimNumber}</span>
        <StageBadge stage={stage} />
        <span className="spacer" />
        <span style={{ color: "var(--muted)", fontSize: 13 }}>{claim.claimant} · {claim.property}</span>
      </div>

      <div className="ws-tabs">
        {([
          ["overview", "Overview"], ["notes", "Notes"], ["documents", "Documents"],
          ["appointments", "Appointments"], ["tasks", "Tasks"],
        ] as [Tab, string][]).map(([id, label]) => (
          <button key={id} className={`ws-tab${tab === id ? " active" : ""}`} onClick={() => setTab(id)}>
            {label}
            {ws && id === "notes" && ws.notes.length > 0 && <span className="ws-count">{ws.notes.length}</span>}
            {ws && id === "documents" && ws.documents.length > 0 && <span className="ws-count">{ws.documents.length}</span>}
            {ws && id === "appointments" && ws.appointments.length > 0 && <span className="ws-count">{ws.appointments.length}</span>}
            {ws && id === "tasks" && ws.tasks.length > 0 && <span className="ws-count">{ws.tasks.length}</span>}
          </button>
        ))}
      </div>

      {!live && (
        <div className="banner" style={{ background: "var(--review,#6b5300)", color: "#fff" }}>
          This is a sample record (offline). Workspace changes require a live Dataverse claim.
        </div>
      )}

      {tab === "overview" && (
        <div className="grid two-col">
          <div className="card cardpad">
            <h3>Case</h3>
            <div className="kv">
              <span className="k">Claimant</span><span className="v">{claim.claimant}</span>
              <span className="k">Property</span><span className="v">{claim.property}</span>
              <span className="k">Department</span><span className="v">{claim.department}</span>
              <span className="k">Incident</span><span className="v">{claim.incidentType}</span>
              <span className="k">Severity</span><span className="v"><SeverityTag severity={claim.severity} /></span>
              <span className="k">Status</span><span className="v"><StatusPill status={claim.status} /></span>
              <span className="k">Adjuster</span><span className="v">{claim.adjuster}</span>
              <span className="k">Reserve</span><span className="v usd">{usd(claim.reserveUsd)}</span>
            </div>
          </div>
          <div className="card cardpad">
            <h3>Lifecycle</h3>
            <div className="field">
              <label>Stage</label>
              <select className="select" value={stage} disabled={!live || busy}
                onChange={(e) => { const s = e.target.value; setStage(s); withBusy(() => updateClaimStage(claim.id, s as CaseStage)); }}>
                {STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 12.5 }}>Partial Intake gate</div>
            <label className="ws-check">
              <input type="checkbox" checked={c1} disabled={!live || busy}
                onChange={(e) => { setC1(e.target.checked); withBusy(() => updateClaimDocs(claim.id, { c1Received: e.target.checked })); }} />
              C-1 received (employee)
            </label>
            <label className="ws-check">
              <input type="checkbox" checked={c4} disabled={!live || busy}
                onChange={(e) => { setC4(e.target.checked); withBusy(() => updateClaimDocs(claim.id, { c4Received: e.target.checked, c4Source: e.target.checked ? "Concentra" : "" })); }} />
              C-4 received (Concentra)
            </label>
            {(!c1 || !c4) && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--review)" }}>
                Stays in Partial Intake until both C-1 and C-4 are received.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "notes" && <NotesTab ws={ws} live={live} busy={busy}
        onAdd={(title, note) => withBusy(() => addNote(claim.id, title, note, user))} />}
      {tab === "documents" && <DocsTab ws={ws} live={live} busy={busy}
        onAdd={(name, type, link) => withBusy(() => addDocument(claim.id, name, type, link, user))} />}
      {tab === "appointments" && <ApptTab ws={ws} live={live} busy={busy}
        onAdd={(subject, start, end, loc, withTask) => withBusy(() => addAppointment(claim.id, subject, start, end, loc, withTask, user))} />}
      {tab === "tasks" && <TasksTab ws={ws} live={live} busy={busy}
        onAdd={(title, who, due) => withBusy(() => addTask(claim.id, title, who, due))}
        onUpdate={(id, ch) => withBusy(() => updateTask(id, ch))} />}
    </div>
  );
}

function NotesTab({ ws, live, busy, onAdd }: { ws: Ws | null; live: boolean; busy: boolean; onAdd: (t: string, n: string) => void }) {
  const [title, setTitle] = useState(""); const [note, setNote] = useState("");
  return (
    <div className="grid two-col">
      <div className="card cardpad">
        <h3>Add note</h3>
        <div className="field"><label>Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional title" /></div>
        <div className="field"><label>Note</label><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Case note…" /></div>
        <button className="btn" disabled={!live || busy || !note.trim()} onClick={() => { onAdd(title, note); setTitle(""); setNote(""); }}>Add note</button>
      </div>
      <div className="card cardpad">
        <h3>Notes</h3>
        {!ws ? <div className="result-empty">Loading…</div> : ws.notes.length === 0 ? <div className="result-empty">No notes yet.</div> :
          ws.notes.map((n) => (
            <div key={n.id} className="ws-item">
              <div className="ws-item-head"><strong>{n.title || "Note"}</strong><span className="who">{n.author} · {fmtDateTime(n.createdOn)}</span></div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5 }}>{n.note}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

function DocsTab({ ws, live, busy, onAdd }: { ws: Ws | null; live: boolean; busy: boolean; onAdd: (name: string, type: DocType, link: string) => void }) {
  const [name, setName] = useState(""); const [type, setType] = useState<DocType>("C-1"); const [link, setLink] = useState("");
  return (
    <div className="grid two-col">
      <div className="card cardpad">
        <h3>Add document</h3>
        <div className="field"><label>Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Signed C-1.pdf" /></div>
        <div className="field"><label>Type</label><select className="select" value={type} onChange={(e) => setType(e.target.value as DocType)}>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="field"><label>Link / location</label><input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="SharePoint URL or path" /></div>
        <button className="btn" disabled={!live || busy || !name.trim()} onClick={() => { onAdd(name, type, link); setName(""); setLink(""); }}>Add document</button>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="claims">
          <thead><tr><th>Document</th><th>Type</th><th>Uploaded</th></tr></thead>
          <tbody>
            {ws?.documents.map((d) => (
              <tr key={d.id}>
                <td>{d.link ? <a href={d.link} target="_blank" rel="noopener noreferrer">{d.name}</a> : d.name}<div className="who">{d.uploadedBy}</div></td>
                <td>{d.docType}</td>
                <td className="who">{fmtDateTime(d.createdOn)}</td>
              </tr>
            ))}
            {ws && ws.documents.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>No documents.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApptTab({ ws, live, busy, onAdd }: { ws: Ws | null; live: boolean; busy: boolean; onAdd: (s: string, st: string, en: string, loc: string, wt: boolean) => void }) {
  const [subject, setSubject] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  const [loc, setLoc] = useState(""); const [withTask, setWithTask] = useState(true);
  return (
    <div className="grid two-col">
      <div className="card cardpad">
        <h3>Add follow-up appointment</h3>
        <div className="field"><label>Subject</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Follow-up with adjuster" /></div>
        <div className="field"><label>Start</label><input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="field"><label>End</label><input className="input" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        <div className="field"><label>Location</label><input className="input" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Optional" /></div>
        <label className="ws-check"><input type="checkbox" checked={withTask} onChange={(e) => setWithTask(e.target.checked)} /> Create a linked task</label>
        <div style={{ marginTop: 10 }}>
          <button className="btn" disabled={!live || busy || !subject.trim() || !start} onClick={() => {
            onAdd(subject, new Date(start).toISOString(), end ? new Date(end).toISOString() : new Date(start).toISOString(), loc, withTask);
            setSubject(""); setStart(""); setEnd(""); setLoc("");
          }}>Add appointment</button>
        </div>
      </div>
      <div className="card cardpad">
        <h3>Appointments</h3>
        {!ws ? <div className="result-empty">Loading…</div> : ws.appointments.length === 0 ? <div className="result-empty">No appointments.</div> :
          ws.appointments.map((a) => (
            <div key={a.id} className="ws-item">
              <div className="ws-item-head"><strong>{a.subject}</strong>{a.hasTask && <span className="badge">task</span>}</div>
              <div className="who">{fmtDateTime(a.start)}{a.location ? ` · ${a.location}` : ""}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

function TasksTab({ ws, live, busy, onAdd, onUpdate }: {
  ws: Ws | null; live: boolean; busy: boolean;
  onAdd: (t: string, who: string, due: string) => void;
  onUpdate: (id: string, ch: { status?: TaskStatus; completionNote?: string; notify?: boolean }) => void;
}) {
  const [title, setTitle] = useState(""); const [who, setWho] = useState(""); const [due, setDue] = useState("");
  return (
    <div className="grid two-col">
      <div className="card cardpad">
        <h3>Add task</h3>
        <div className="field"><label>Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label>Assigned to</label><input className="input" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Name" /></div>
        <div className="field"><label>Due date</label><input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        <button className="btn" disabled={!live || busy || !title.trim()} onClick={() => { onAdd(title, who, due); setTitle(""); setWho(""); setDue(""); }}>Add task</button>
      </div>
      <div className="card cardpad">
        <h3>Tasks</h3>
        {!ws ? <div className="result-empty">Loading…</div> : ws.tasks.length === 0 ? <div className="result-empty">No tasks.</div> :
          ws.tasks.map((t) => <TaskRow key={t.id} task={t} busy={busy} onUpdate={onUpdate} />)}
      </div>
    </div>
  );
}

function TaskRow({ task, busy, onUpdate }: { task: import("../data/seed").CaseTask; busy: boolean; onUpdate: (id: string, ch: { status?: TaskStatus; completionNote?: string; notify?: boolean }) => void }) {
  const [completing, setCompleting] = useState(false);
  const [note, setNote] = useState(""); const [notify, setNotify] = useState(false);
  const overdue = task.status !== "Completed" && task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10);
  return (
    <div className="ws-item">
      <div className="ws-item-head">
        <strong style={{ textDecoration: task.status === "Completed" ? "line-through" : "none" }}>{task.title}</strong>
        <span className={`badge${overdue ? " overdue" : ""}`}>{overdue ? "Overdue" : task.status}</span>
      </div>
      <div className="who">{task.assignedTo || "Unassigned"}{task.dueDate ? ` · due ${fmtDate(task.dueDate)}` : ""}</div>
      {task.completionNote && <div style={{ fontSize: 12.5, marginTop: 4, fontStyle: "italic", color: "var(--muted)" }}>{task.completionNote}</div>}
      {task.status !== "Completed" && !completing && (
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          {task.status === "Open" && <button className="btn ghost" disabled={busy} onClick={() => onUpdate(task.id, { status: "In Progress" })}>Start</button>}
          <button className="btn ghost" disabled={busy} onClick={() => setCompleting(true)}>Complete…</button>
        </div>
      )}
      {completing && (
        <div style={{ marginTop: 8 }}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Completion note (optional)" style={{ minHeight: 60 }} />
          <label className="ws-check"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Notify</label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn" disabled={busy} onClick={() => { onUpdate(task.id, { status: "Completed", completionNote: note, notify }); setCompleting(false); }}>Mark complete</button>
            <button className="btn ghost" onClick={() => setCompleting(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
