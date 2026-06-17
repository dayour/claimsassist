// Incident classifier — local deterministic stand-in for the Copilot Studio
// "Prompt" node (GPT-4.1 mini) shown in the capture, which classified an
// incident from Dataverse + PDF context. Keyword-driven so the UI is fully
// functional offline. Swap classifyIncident() for a real Dataverse/Copilot
// Studio call when wiring the Power Platform backend.

import type { Classification, IncidentType, Severity } from "../data/seed";

interface Rule {
  category: IncidentType;
  keywords: string[];
  baseSeverity: Severity;
  action: string;
}

const RULES: Rule[] = [
  {
    category: "Slip / Trip / Fall",
    keywords: ["slip", "slipped", "trip", "tripped", "fell", "fall", "wet floor", "wet surface"],
    baseSeverity: "Moderate",
    action: "Verify wet-floor signage; order imaging for the impacted joint.",
  },
  {
    category: "Lifting / Overexertion",
    keywords: ["lift", "lifting", "carry", "carrying", "strain", "pulled", "overexert", "heavy"],
    baseSeverity: "Moderate",
    action: "Assign nurse case manager; light-duty restriction.",
  },
  {
    category: "Repetitive Strain",
    keywords: ["repetitive", "persistent", "over time", "extended shift", "gradual", "chronic", "tendon"],
    baseSeverity: "Low",
    action: "Schedule ergonomic assessment; rotate task assignments.",
  },
  {
    category: "Struck By Object",
    keywords: ["struck", "hit by", "falling", "fell on", "panel", "dropped on"],
    baseSeverity: "High",
    action: "Inspect overhead rigging; concussion protocol if head involved.",
  },
  {
    category: "Equipment / Machinery",
    keywords: ["machine", "machinery", "equipment", "caught between", "pinch", "pump", "gear", "blade"],
    baseSeverity: "High",
    action: "Lock-out/tag-out review; equipment safety inspection.",
  },
  {
    category: "Vehicle / Cart",
    keywords: ["vehicle", "cart", "forklift", "shuttle", "valet", "luggage cart"],
    baseSeverity: "Moderate",
    action: "Review traffic pattern and right-of-way controls.",
  },
  {
    category: "Chemical Exposure",
    keywords: ["chemical", "fumes", "cleaning agent", "solvent", "exposure", "irritation", "inhaled"],
    baseSeverity: "Moderate",
    action: "Pull SDS; check ventilation; confirm work-related causation.",
  },
  {
    category: "Burn / Heat",
    keywords: ["burn", "burned", "hot", "scald", "steam", "grease", "flame"],
    baseSeverity: "Low",
    action: "Document first aid; assess burn degree and surface area.",
  },
];

const HIGH_SEVERITY_SIGNALS = [
  "head", "skull", "concussion", "fracture", "broken", "amputat", "laceration",
  "deep", "unconscious", "hospital", "surgery", "spine", "spinal",
];

const LOW_SEVERITY_SIGNALS = [
  "minor", "mild", "first aid", "no lost time", "superficial", "small",
];

function escalate(s: Severity): Severity {
  const order: Severity[] = ["Low", "Moderate", "High", "Critical"];
  return order[Math.min(order.length - 1, order.indexOf(s) + 1)];
}
function deescalate(s: Severity): Severity {
  const order: Severity[] = ["Low", "Moderate", "High", "Critical"];
  return order[Math.max(0, order.indexOf(s) - 1)];
}

export function classifyIncident(description: string): Classification {
  const text = description.toLowerCase();

  // Score each rule by keyword hits.
  let best: Rule | null = null;
  let bestHits = 0;
  for (const rule of RULES) {
    const hits = rule.keywords.filter((k) => text.includes(k)).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = rule;
    }
  }

  if (!best || bestHits === 0) {
    return {
      category: "Other",
      severity: "Moderate",
      confidence: 0.4,
      recommendedAction: "Route to adjuster for manual review — no clear pattern detected.",
      rationale: "No strong keyword signal matched a known incident category.",
      model: "GPT-4.1 mini",
    };
  }

  let severity = best.baseSeverity;
  if (HIGH_SEVERITY_SIGNALS.some((k) => text.includes(k))) severity = escalate(severity);
  if (LOW_SEVERITY_SIGNALS.some((k) => text.includes(k))) severity = deescalate(severity);

  // Confidence scales with keyword density, capped.
  const confidence = Math.min(0.97, 0.6 + bestHits * 0.12);

  return {
    category: best.category,
    severity,
    confidence: Math.round(confidence * 100) / 100,
    recommendedAction: best.action,
    rationale: `Matched ${bestHits} signal${bestHits > 1 ? "s" : ""} for "${best.category}"; severity adjusted from injury descriptors.`,
    model: "GPT-4.1 mini",
  };
}

export function nextClaimNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  const nums = existing
    .map((n) => parseInt(n.split("-").pop() || "0", 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 1000) + 1;
  return `OWCP-${year}-${next}`;
}
