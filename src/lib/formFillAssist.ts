import type { Classification, IncidentType, Severity } from "../data/seed";
import { INCIDENT_TYPES } from "../data/seed";
import { classifyIncident } from "./classifier";
import { performUnboundAction, predictWithAiBuilder } from "./dataverseActions";

export interface FormFillAssistInput {
  claimant: string;
  region: string;
  department: string;
  adjuster: string;
  dateOfInjury: string;
  bodyPart: string;
  description: string;
}

export interface FormFillAssistResult {
  classification: Classification;
  bodyPart?: string;
  adjuster?: string;
  reserveUsd?: number;
  source: "dataverse-action" | "ai-builder" | "local";
  warning?: string;
}

const FORM_FILL_ACTION = import.meta.env.VITE_FORM_FILL_ASSIST_ACTION?.trim() ?? "";
const AI_BUILDER_MODEL_ID = import.meta.env.VITE_AI_BUILDER_MODEL_ID?.trim() ?? "";

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function unwrap(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const row = raw as Record<string, unknown>;
  const dynamic = row.dynamicProperties;
  return dynamic && typeof dynamic === "object" ? (dynamic as Record<string, unknown>) : row;
}

function stringValue(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function numberValue(row: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function asIncidentType(value: string, fallback: IncidentType): IncidentType {
  return INCIDENT_TYPES.includes(value as IncidentType) ? (value as IncidentType) : fallback;
}

function asSeverity(value: string, fallback: Severity): Severity {
  return ["Low", "Moderate", "High", "Critical"].includes(value) ? (value as Severity) : fallback;
}

function normalizeAssist(raw: unknown, fallback: Classification, source: FormFillAssistResult["source"]): FormFillAssistResult {
  const row = unwrap(raw);
  const category = asIncidentType(
    stringValue(row, ["incidentType", "category", "owcp_incidenttype", "IncidentType", "Category"]),
    fallback.category
  );
  const severity = asSeverity(
    stringValue(row, ["severity", "owcp_severity", "Severity"]),
    fallback.severity
  );
  const confidence = numberValue(row, ["confidence", "owcp_classifierconfidence", "Confidence"]);
  const recommendedAction = stringValue(row, [
    "recommendedAction",
    "owcp_recommendedaction",
    "RecommendedAction",
    "recommendation",
  ]);
  const model = stringValue(row, ["model", "owcp_classifiermodel", "Model"]);

  return {
    source,
    classification: {
      category,
      severity,
      confidence: confidence ?? fallback.confidence,
      recommendedAction: recommendedAction || fallback.recommendedAction,
      rationale: stringValue(row, ["rationale", "Rationale"]) || fallback.rationale,
      model: model || (source === "ai-builder" ? "AI Builder" : fallback.model),
    },
    bodyPart: stringValue(row, ["bodyPart", "owcp_bodypart", "BodyPart"]) || undefined,
    adjuster: stringValue(row, ["adjuster", "owcp_adjuster", "Adjuster"]) || undefined,
    reserveUsd: numberValue(row, ["reserveUsd", "owcp_reserveusd", "ReserveUsd"]),
  };
}

async function runDataverseAction(input: FormFillAssistInput, fallback: Classification): Promise<FormFillAssistResult> {
  const data = await performUnboundAction(FORM_FILL_ACTION, {
    input: { ...input, property: input.region },
    description: input.description,
  });
  return normalizeAssist(data, fallback, "dataverse-action");
}

async function runAiBuilderPrediction(input: FormFillAssistInput, fallback: Classification): Promise<FormFillAssistResult> {
  const data = await predictWithAiBuilder(AI_BUILDER_MODEL_ID, {
    input: { ...input, property: input.region },
    text: input.description,
  });
  return normalizeAssist(data, fallback, "ai-builder");
}

export async function requestFormFillAssist(input: FormFillAssistInput): Promise<FormFillAssistResult> {
  const fallback = classifyIncident(input.description);
  if (FORM_FILL_ACTION) {
    try {
      return await runDataverseAction(input, fallback);
    } catch (e) {
      return { classification: fallback, source: "local", warning: `Form Fill Assist action failed: ${errMessage(e)}` };
    }
  }
  if (AI_BUILDER_MODEL_ID) {
    try {
      return await runAiBuilderPrediction(input, fallback);
    } catch (e) {
      return { classification: fallback, source: "local", warning: `AI Builder prediction failed: ${errMessage(e)}` };
    }
  }
  return { classification: fallback, source: "local" };
}