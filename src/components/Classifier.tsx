import { useState } from "react";
import type { Classification } from "../data/seed";
import { classifyIncident } from "../lib/classifier";
import { SeverityTag } from "./ui";

const SAMPLES = [
  "Slipped on a wet kitchen floor near the dish pit and broke the fall with the right hand.",
  "Caught a hand between a pump housing and bracket during maintenance; deep laceration to two fingers.",
  "Persistent shoulder pain after several extended table-game dealing shifts over a busy weekend.",
  "Struck on the head by a falling decorative panel during banquet teardown; brief dizziness.",
  "Minor burn on the forearm from a hot sauté pan handle on the line.",
];

export default function Classifier() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Classification | null>(null);
  const [running, setRunning] = useState(false);

  function run() {
    if (!text.trim()) return;
    setRunning(true);
    // Simulate the Copilot Studio prompt latency.
    setTimeout(() => {
      setResult(classifyIncident(text));
      setRunning(false);
    }, 450);
  }

  return (
    <div>
      <p style={{ color: "var(--muted)", marginTop: 0, maxWidth: 720 }}>
        The incident classifier mirrors the Copilot Studio workflow: a{" "}
        <strong>GPT-4.1 mini</strong> prompt node reads the incident narrative (plus Dataverse
        context) and returns a category, severity and recommended action.
      </p>

      <div className="classifier-grid">
        <div className="card cardpad">
          <h3>Incident Narrative</h3>
          <textarea
            style={{ width: "100%", minHeight: 150 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste or type an incident description…"
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
            {SAMPLES.map((s, i) => (
              <button key={i} className="sample-chip" onClick={() => { setText(s); setResult(null); }}>
                Sample {i + 1}
              </button>
            ))}
          </div>
          <button className="btn" disabled={!text.trim() || running} onClick={run}>
            {running ? "Classifying…" : "Run Classifier"}
          </button>
        </div>

        <div className="card cardpad" style={{ minHeight: 260 }}>
          <h3>Classification Result</h3>
          {!result && <div className="result-empty">Run the classifier to see a category, severity and recommended action.</div>}
          {result && (
            <div>
              <div className="result-row"><span className="k">Category</span><strong>{result.category}</strong></div>
              <div className="result-row"><span className="k">Severity</span><SeverityTag severity={result.severity} /></div>
              <div className="result-row" style={{ borderBottom: "none" }}><span className="k">Model</span><span>{result.model}</span></div>
              <div style={{ marginTop: 16, fontSize: 12.5, color: "var(--muted)" }}>Recommended Action</div>
              <div style={{ fontSize: 13.5, marginTop: 4 }}>{result.recommendedAction}</div>
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>{result.rationale}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
