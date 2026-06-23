// Seed data for Claim_Studio — Workers' Comp Claims Tracker.
// Seeded from the OWCP capture (Workers Comp Claims Tracker
// working session) — participants, regions, and the Copilot Studio
// incident-classifier concept inform this sample dataset.

export type ClaimStatus =
  | "New"
  | "Under Review"
  | "Classified"
  | "Approved"
  | "Denied"
  | "Closed";

export type Severity = "Low" | "Moderate" | "High" | "Critical";

export type IncidentType =
  | "Slip / Trip / Fall"
  | "Lifting / Overexertion"
  | "Repetitive Strain"
  | "Struck By Object"
  | "Equipment / Machinery"
  | "Vehicle / Cart"
  | "Chemical Exposure"
  | "Burn / Heat"
  | "Other";

export interface Classification {
  category: IncidentType;
  severity: Severity;
  confidence: number; // 0..1
  recommendedAction: string;
  rationale: string;
  model: string;
}

export interface Claim {
  id: string;
  claimNumber: string;
  claimant: string;
  region: string;
  department: string;
  dateOfInjury: string; // ISO date
  dateReported: string; // ISO date
  incidentType: IncidentType;
  bodyPart: string;
  status: ClaimStatus;
  severity: Severity;
  adjuster: string;
  reserveUsd: number;
  stage?: string;
  c1Received?: boolean;
  c4Received?: boolean;
  c4Source?: string;
  description: string;
  classification?: Classification;
}

export interface ClaimsFilter {
  q?: string;
  status?: ClaimStatus;
  region?: string;
  incidentType?: IncidentType;
  openActive?: boolean;
  classifiedOnly?: boolean;
}

export const REGIONS = [
  "Pacific",
  "East Coast",
  "EMEA",
  "ROW",
] as const;

export const DEPARTMENTS = [
  "Housekeeping",
  "Food & Beverage",
  "Casino Floor",
  "Facilities / Engineering",
  "Security",
  "Hotel Operations",
  "Culinary",
  "Valet / Transportation",
] as const;

export const ADJUSTERS = [
  "Alan Spector",
  "Bob Smith",
  "Ashley Samstone",
  "Anton Clipeus",
  "Darbot Timelarp",
] as const;

export const INCIDENT_TYPES: IncidentType[] = [
  "Slip / Trip / Fall",
  "Lifting / Overexertion",
  "Repetitive Strain",
  "Struck By Object",
  "Equipment / Machinery",
  "Vehicle / Cart",
  "Chemical Exposure",
  "Burn / Heat",
  "Other",
];

export const STATUSES: ClaimStatus[] = [
  "New",
  "Under Review",
  "Classified",
  "Approved",
  "Denied",
  "Closed",
];

// Case lifecycle stage (WC boards). Distinct from the legacy status field.
export type CaseStage =
  | "Partial Intake"
  | "Ready to Submit"
  | "Submitted to Sedgwick"
  | "Adjustment"
  | "Case Management"
  | "Completed";

export const STAGES: CaseStage[] = [
  "Partial Intake",
  "Ready to Submit",
  "Submitted to Sedgwick",
  "Adjustment",
  "Case Management",
  "Completed",
];

export type TaskStatus = "Open" | "In Progress" | "Completed";
export const TASK_STATUSES: TaskStatus[] = ["Open", "In Progress", "Completed"];
export type DocType = "C-1" | "C-4" | "Medical" | "Correspondence" | "Other";
export const DOC_TYPES: DocType[] = ["C-1", "C-4", "Medical", "Correspondence", "Other"];

export interface CaseNote {
  id: string;
  claimId: string;
  title: string;
  note: string;
  author: string;
  createdOn: string;
}
export interface CaseDocument {
  id: string;
  claimId: string;
  name: string;
  docType: DocType;
  link: string;
  uploadedBy: string;
  createdOn: string;
}
export interface CaseAppointment {
  id: string;
  claimId: string;
  claimNumber?: string;
  subject: string;
  start: string;
  end: string;
  location: string;
  hasTask: boolean;
}
export interface CaseTask {
  id: string;
  claimId: string;
  claimNumber?: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  status: TaskStatus;
  completionNote: string;
  notify: boolean;
}

export interface Workspace {
  notes: CaseNote[];
  documents: CaseDocument[];
  appointments: CaseAppointment[];
  tasks: CaseTask[];
}


export const claims: Claim[] = [
  {
    id: "c-1001",
    claimNumber: "OWCP-2026-1001",
    claimant: "Maria Delgado",
    region: "Pacific",
    department: "Housekeeping",
    dateOfInjury: "2026-05-12",
    dateReported: "2026-05-12",
    incidentType: "Lifting / Overexertion",
    bodyPart: "Lower back",
    status: "Approved",
    severity: "Moderate",
    adjuster: "Alan Spector",
    reserveUsd: 8400,
    description:
      "Strained lower back lifting a stack of wet linens onto a housekeeping cart on the 22nd floor.",
    classification: {
      category: "Lifting / Overexertion",
      severity: "Moderate",
      confidence: 0.92,
      recommendedAction: "Assign nurse case manager; light-duty restriction 2 weeks.",
      rationale:
        "Mechanism (manual lifting) and body part (lumbar) match overexertion pattern; no acute trauma indicators.",
      model: "GPT-4.1 mini",
    },
  },
  {
    id: "c-1002",
    claimNumber: "OWCP-2026-1002",
    claimant: "Anthony Russo",
    region: "EMEA",
    department: "Food & Beverage",
    dateOfInjury: "2026-05-18",
    dateReported: "2026-05-19",
    incidentType: "Slip / Trip / Fall",
    bodyPart: "Right wrist",
    status: "Under Review",
    severity: "Moderate",
    adjuster: "Bob Smith",
    reserveUsd: 6200,
    description:
      "Slipped on a wet kitchen floor near the dish pit; broke fall with right hand. Possible wrist sprain.",
    classification: {
      category: "Slip / Trip / Fall",
      severity: "Moderate",
      confidence: 0.88,
      recommendedAction: "Order wrist imaging; verify wet-floor signage compliance.",
      rationale:
        "Wet-surface slip with outstretched-hand mechanism; distal upper-extremity injury.",
      model: "GPT-4.1 mini",
    },
  },
  {
    id: "c-1003",
    claimNumber: "OWCP-2026-1003",
    claimant: "Priya Nair",
    region: "Pacific",
    department: "Casino Floor",
    dateOfInjury: "2026-05-22",
    dateReported: "2026-05-22",
    incidentType: "Repetitive Strain",
    bodyPart: "Shoulder",
    status: "Classified",
    severity: "Low",
    adjuster: "Ashley Samstone",
    reserveUsd: 3100,
    description:
      "Dealer reporting persistent right shoulder pain after extended table-game shifts during a busy weekend.",
    classification: {
      category: "Repetitive Strain",
      severity: "Low",
      confidence: 0.81,
      recommendedAction: "Ergonomic assessment; rotate dealer stations.",
      rationale:
        "Gradual onset, repetitive motion exposure, no single traumatic event.",
      model: "GPT-4.1 mini",
    },
  },
  {
    id: "c-1004",
    claimNumber: "OWCP-2026-1004",
    claimant: "Marcus Bell",
    region: "East Coast",
    department: "Facilities / Engineering",
    dateOfInjury: "2026-05-24",
    dateReported: "2026-05-26",
    incidentType: "Equipment / Machinery",
    bodyPart: "Left hand",
    status: "New",
    severity: "High",
    adjuster: "Anton Clipeus",
    reserveUsd: 15800,
    description:
      "Hand caught between a pump housing and bracket during preventative maintenance in the central plant. Lacerations to two fingers.",
  },
  {
    id: "c-1005",
    claimNumber: "OWCP-2026-1005",
    claimant: "Sofia Marchetti",
    region: "ROW",
    department: "Hotel Operations",
    dateOfInjury: "2026-05-27",
    dateReported: "2026-05-28",
    incidentType: "Struck By Object",
    bodyPart: "Head",
    status: "New",
    severity: "High",
    adjuster: "Alan Spector",
    reserveUsd: 12400,
    description:
      "Struck on the head by a falling decorative panel in a banquet ballroom during event teardown.",
  },
  {
    id: "c-1006",
    claimNumber: "OWCP-2026-1006",
    claimant: "Derek Olsen",
    region: "Pacific",
    department: "Valet / Transportation",
    dateOfInjury: "2026-05-29",
    dateReported: "2026-05-29",
    incidentType: "Vehicle / Cart",
    bodyPart: "Knee",
    status: "Under Review",
    severity: "Moderate",
    adjuster: "Bob Smith",
    reserveUsd: 7300,
    description:
      "Valet struck below the knee by a slow-moving luggage cart at the porte-cochère.",
    classification: {
      category: "Vehicle / Cart",
      severity: "Moderate",
      confidence: 0.79,
      recommendedAction: "Review cart traffic pattern; knee evaluation.",
      rationale: "Low-speed vehicle contact, isolated lower-extremity impact.",
      model: "GPT-4.1 mini",
    },
  },
  {
    id: "c-1007",
    claimNumber: "OWCP-2026-1007",
    claimant: "Hannah Cole",
    region: "EMEA",
    department: "Culinary",
    dateOfInjury: "2026-04-30",
    dateReported: "2026-04-30",
    incidentType: "Burn / Heat",
    bodyPart: "Forearm",
    status: "Closed",
    severity: "Low",
    adjuster: "Ashley Samstone",
    reserveUsd: 2200,
    description:
      "Minor second-degree burn on forearm from contact with a hot sauté pan handle on the line.",
    classification: {
      category: "Burn / Heat",
      severity: "Low",
      confidence: 0.95,
      recommendedAction: "First aid documented; closed, no lost time.",
      rationale: "Thermal contact injury, limited surface area, no complications.",
      model: "GPT-4.1 mini",
    },
  },
  {
    id: "c-1008",
    claimNumber: "OWCP-2026-1008",
    claimant: "Victor Tran",
    region: "Pacific",
    department: "Security",
    dateOfInjury: "2026-05-03",
    dateReported: "2026-05-04",
    incidentType: "Chemical Exposure",
    bodyPart: "Eyes / respiratory",
    status: "Denied",
    severity: "Moderate",
    adjuster: "Anton Clipeus",
    reserveUsd: 0,
    description:
      "Officer reported irritation after exposure to cleaning agents in a back-of-house corridor; investigation found no work-related causation.",
    classification: {
      category: "Chemical Exposure",
      severity: "Moderate",
      confidence: 0.64,
      recommendedAction: "SDS review; ventilation check (causation not established).",
      rationale:
        "Reported chemical irritation but exposure source unconfirmed during review.",
      model: "GPT-4.1 mini",
    },
  },
];

// Reference to the source capture that seeded this app.
export const CAPTURE = {
  source: "Screen Recording 2026-05-29 100241.mp4",
  session: "Claim_Studio | Weekly Working Session",
  durationLabel: "22:56",
  frameCount: 33,
  engine: "Yumlog Paperboy half-step bisection",
  environment: "Legal Dev Environment · Claim_Studio",
  built: "Workers Comp Claims Tracker (Power Apps) + Copilot Studio incident classifier",
  viewerPath: "../yumlog-capture-app/index.html",
};
