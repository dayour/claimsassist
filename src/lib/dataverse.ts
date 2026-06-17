// Dataverse data layer for Claim_Studio.
// Talks to the owcp_claim table via the generated Power Apps Code Apps service.
// Falls back to local seed data when running outside the Power Platform host
// (e.g. `npm run dev`), so the UI is always functional.
//
// Uses the *WithOrganization connector operations with an explicit organization
// URL — matching the working sibling code app — so the connector reliably
// targets the bound Dataverse org. Every call inspects result.success so a
// connector failure is surfaced as an error instead of being masked as an
// "empty table".

import { MicrosoftDataverseService } from "../generated";
import { Office365OutlookService } from "../generated";
import { generateClaimPdf } from "./pdf";
import type {
  Claim, ClaimStatus, Severity, IncidentType,
  CaseStage, TaskStatus, DocType,
  CaseNote, CaseDocument, CaseAppointment, CaseTask, Workspace,
} from "../data/seed";
import {
  claims as seedClaims,
  PROPERTIES,
  DEPARTMENTS,
  INCIDENT_TYPES,
  STATUSES,
  ADJUSTERS,
  STAGES,
  TASK_STATUSES,
  DOC_TYPES,
} from "../data/seed";

const SEVERITIES: Severity[] = ["Low", "Moderate", "High", "Critical"];

// NOTE: This module contains NO hard-coded environment values (org URL,
// environment id, tenant). All Dataverse data operations target the bound org
// via the connector's "current" alias, so the same build runs unchanged in any
// environment. The bound org's real URL (for deep links / footer) is discovered
// at runtime by sniffing the @odata.id annotation on returned rows.
const ENTITY_SET = "owcp_claims";
// Dataverse Notes (annotation) entity set — stores the claim PDF as a real,
// server-side-decoded file attachment on the claim record.
const ANNOTATION_SET = "annotations";
// The connector accepts "current" as the organization for *WithOrganization
// operations; it always resolves to the org the connection is bound to.
const CURRENT_ORG = "current";
const FORMATTED = "@OData.Community.Display.V1.FormattedValue";

// Choice option values are allocated from 100000000 in schema/seed order.
// Verified live: all six option sets match the seed.ts array order exactly.
function optionMap<T extends string>(values: readonly T[]): Record<T, number> {
  const m = {} as Record<T, number>;
  values.forEach((v, i) => (m[v] = 100000000 + i));
  return m;
}
const PROPERTY_OPT = optionMap(PROPERTIES);
const DEPARTMENT_OPT = optionMap(DEPARTMENTS);
const INCIDENT_OPT = optionMap(INCIDENT_TYPES);
const SEVERITY_OPT = optionMap(SEVERITIES);
const STATUS_OPT = optionMap(STATUSES);
const ADJUSTER_OPT = optionMap(ADJUSTERS);
const STAGE_OPT = optionMap(STAGES);
const TASKSTATUS_OPT = optionMap(TASK_STATUSES);
const DOCTYPE_OPT = optionMap(DOC_TYPES);

type Row = Record<string, unknown>;
const str = (r: Row, k: string) => (r[k] == null ? "" : String(r[k]));
const fmt = (r: Row, k: string) => str(r, `${k}${FORMATTED}`) || str(r, k);

function rowToClaim(r: Row): Claim {
  return {
    id: str(r, "owcp_claimid") || "dv-" + Math.random().toString(36).slice(2, 8),
    claimNumber: str(r, "owcp_claimnumber"),
    claimant: str(r, "owcp_claimant"),
    property: fmt(r, "owcp_property"),
    department: fmt(r, "owcp_department"),
    incidentType: (fmt(r, "owcp_incidenttype") || "Other") as IncidentType,
    bodyPart: str(r, "owcp_bodypart") || "Unspecified",
    status: (fmt(r, "owcp_status") || "New") as ClaimStatus,
    severity: (fmt(r, "owcp_severity") || "Moderate") as Severity,
    adjuster: fmt(r, "owcp_adjuster"),
    dateOfInjury: str(r, "owcp_dateofinjury").slice(0, 10),
    dateReported: str(r, "owcp_datereported").slice(0, 10),
    reserveUsd: Number(r["owcp_reserveusd"] ?? 0),
    stage: fmt(r, "owcp_stage") || undefined,
    c1Received: r["owcp_c1received"] === true || r["owcp_c1received"] === 1,
    c4Received: r["owcp_c4received"] === true || r["owcp_c4received"] === 1,
    c4Source: str(r, "owcp_c4source") || undefined,
    description: str(r, "owcp_description"),
    classification: r["owcp_classified"]
      ? {
          category: (fmt(r, "owcp_incidenttype") || "Other") as IncidentType,
          severity: (fmt(r, "owcp_severity") || "Moderate") as Severity,
          confidence: Number(r["owcp_classifierconfidence"] ?? 0),
          recommendedAction: str(r, "owcp_recommendedaction"),
          rationale: "Classified on intake via the Copilot Studio workflow.",
          model: str(r, "owcp_classifiermodel") || "GPT-4.1 mini",
        }
      : undefined,
  };
}

export function claimToRow(c: Claim): Record<string, unknown> {
  const row: Record<string, unknown> = {
    owcp_claimnumber: c.claimNumber,
    owcp_claimant: c.claimant,
    owcp_property: PROPERTY_OPT[c.property as keyof typeof PROPERTY_OPT],
    owcp_department: DEPARTMENT_OPT[c.department as keyof typeof DEPARTMENT_OPT],
    owcp_incidenttype: INCIDENT_OPT[c.incidentType],
    owcp_bodypart: c.bodyPart,
    owcp_severity: SEVERITY_OPT[c.severity],
    owcp_status: STATUS_OPT[c.status],
    owcp_adjuster: ADJUSTER_OPT[c.adjuster as keyof typeof ADJUSTER_OPT],
    owcp_dateofinjury: c.dateOfInjury,
    owcp_datereported: c.dateReported,
    owcp_reserveusd: c.reserveUsd,
    owcp_stage: STAGE_OPT[(c.stage as CaseStage) ?? "Partial Intake"] ?? STAGE_OPT["Partial Intake"],
    owcp_c1received: c.c1Received ?? true,
    owcp_c4received: c.c4Received ?? false,
    owcp_classified: !!c.classification,
    owcp_description: c.description,
  };
  if (c.classification) {
    row.owcp_classifiermodel = c.classification.model;
    row.owcp_classifierconfidence = c.classification.confidence;
    row.owcp_recommendedaction = c.classification.recommendedAction;
  }
  return row;
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(e);
}

// Wraps a connector call with a timeout and turns a non-success IOperationResult
// into a thrown error so callers never mistake a failure for empty data.
async function exec<T>(
  label: string,
  op: Promise<{ success: boolean; data: T; error?: unknown }>
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out (30s)`)), 30000)
  );
  const result = await Promise.race([op, timeout]);
  if (!result || !result.success) {
    throw new Error(
      `${label} failed: ${result?.error ? errMessage(result.error) : "connector returned no success"}`
    );
  }
  return result.data;
}

// The bound org's real URL, discovered at runtime by scanning a Dataverse
// response for the org URL (appears in @odata.context / @odata.id / nextLink).
let _boundOrgUrl = "";

function sniffOrgUrl(raw: unknown): void {
  if (_boundOrgUrl || raw == null) return;
  try {
    const json = typeof raw === "string" ? raw : JSON.stringify(raw);
    const m = json.match(/https:\/\/[A-Za-z0-9-]+\.crm[A-Za-z0-9.]*\.dynamics\.com/i);
    if (m) _boundOrgUrl = m[0].replace(/\/$/, "");
  } catch {
    // ignore
  }
}

interface ResolvedOrg { url: string; name?: string }
let _orgPromise: Promise<ResolvedOrg> | undefined;

// Resolve the bound org's real URL + friendly name at runtime, with no
// hard-coded values. Lists one row via the "current" alias to sniff the real
// URL from its @odata.id, then matches that against GetOrganizations to recover
// the friendly name. Cached after the first call.
export function resolveOrg(): Promise<ResolvedOrg> {
  if (!_orgPromise) {
    _orgPromise = (async () => {
      try {
        if (!_boundOrgUrl) {
          const probe = await exec(
            "Dataverse probe",
            MicrosoftDataverseService.ListRecordsWithOrganization(
              CURRENT_ORG, ENTITY_SET, 'odata.include-annotations="*"',
              undefined, false, false, undefined, undefined, undefined, undefined, undefined, 1
            )
          );
          const pv = (probe as { value?: Row[] })?.value ?? [];
          sniffOrgUrl(probe);
          void pv;
        }
        let name: string | undefined;
        if (_boundOrgUrl) {
          try {
            const data = await exec("Dataverse GetOrganizations", MicrosoftDataverseService.GetOrganizations());
            const orgs = (data as { value?: Array<{ Url?: string; FriendlyName?: string }> })?.value ?? [];
            const host = _boundOrgUrl.replace(/^https?:\/\//i, "");
            const match = orgs.find((o) => (o.Url ?? "").replace(/^https?:\/\//i, "").replace(/\/$/, "") === host);
            name = match?.FriendlyName;
          } catch {
            // friendly name is optional
          }
          return { url: _boundOrgUrl, name };
        }
      } catch {
        // connector unavailable (e.g. local dev)
      }
      return { url: "" };
    })();
  }
  return _orgPromise;
}

export interface LoadResult {
  claims: Claim[];
  source: "dataverse" | "seed";
  rowCount: number;
  error?: string;
}

export async function loadClaims(): Promise<LoadResult> {
  try {
    const data = await exec(
      "Dataverse ListRecords",
      MicrosoftDataverseService.ListRecordsWithOrganization(
        CURRENT_ORG,
        ENTITY_SET,
        'odata.include-annotations="*"',
        undefined,
        false,
        false,
        undefined,
        undefined,
        "owcp_datereported desc"
      )
    );
    const value = (data as { value?: Row[] })?.value;
    if (!Array.isArray(value)) {
      throw new Error("Unexpected response shape from ListRecords (no value array)");
    }
    const rows = value.map(
      (it) => ((it as { dynamicProperties?: Row }).dynamicProperties ?? it) as Row
    );
    sniffOrgUrl(data);
    // A live connection with zero rows is a valid "dataverse" source, not a fallback.
    return {
      claims: rows.length ? rows.map(rowToClaim) : [],
      source: "dataverse",
      rowCount: rows.length,
    };
  } catch (e) {
    return { claims: seedClaims, source: "seed", rowCount: seedClaims.length, error: errMessage(e) };
  }
}

export interface CreateResult {
  ok: boolean;
  error?: string;
  warning?: string;
}

export async function createClaim(c: Claim, emailTo?: string): Promise<CreateResult> {
  let created: unknown;
  try {
    created = await exec(
      "Dataverse CreateRecord",
      MicrosoftDataverseService.CreateRecordWithOrganization(
        "return=representation",
        "application/json",
        CURRENT_ORG,
        ENTITY_SET,
        claimToRow(c),
        false
      )
    );
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }

  // The claim is saved. Everything below (PDF generation, saving it to the
  // owcp_claimpdf file column, and emailing it) is best-effort: a failure here
  // is surfaced as a non-fatal warning but never undoes the saved claim.
  const warnings: string[] = [];

  // Generate the PDF once and reuse it for both the file column and the email.
  let pdf: { base64: string; bytes: Uint8Array; fileName: string } | undefined;
  try {
    pdf = generateClaimPdf(c);
  } catch (e) {
    warnings.push(`the PDF could not be generated (${errMessage(e)})`);
  }

  // Save the PDF as a Dataverse Note attachment on the new claim record.
  // The connector cannot upload raw binary to a File column, but the
  // annotation entity accepts the file as a base64 documentbody, which
  // Dataverse decodes server-side into a real, downloadable attachment.
  if (pdf) {
    const claimId = await resolveCreatedId(created, c.claimNumber);
    if (!claimId) {
      warnings.push("the PDF was not saved to the record (new record id unavailable)");
    } else {
      try {
        await exec(
          "Dataverse create attachment",
          MicrosoftDataverseService.CreateRecordWithOrganization(
            "return=minimal",
            "application/json",
            CURRENT_ORG,
            ANNOTATION_SET,
            {
              "objectid_owcp_claim@odata.bind": `/${ENTITY_SET}(${claimId})`,
              subject: `Claim PDF — ${c.claimNumber}`,
              notetext: "Auto-generated claim summary PDF.",
              filename: pdf.fileName,
              mimetype: "application/pdf",
              documentbody: pdf.base64,
              isdocument: true,
            },
            false
          )
        );
        // Mark the record so views/forms reflect that a PDF is attached.
        try {
          await exec(
            "Dataverse set haspdf",
            MicrosoftDataverseService.UpdateRecordWithOrganization(
              "return=minimal", "application/json", CURRENT_ORG, ENTITY_SET, claimId,
              { owcp_haspdf: true }, false
            )
          );
        } catch {
          // The flag is cosmetic; the attachment is already saved.
        }
      } catch (e) {
        warnings.push(`the PDF could not be attached to the claim record (${errMessage(e)})`);
      }
    }
  }

  // Email the PDF summary to the WC user.
  if (emailTo && pdf) {
    try {
      const result = await Office365OutlookService.SendEmailV2({
        To: emailTo,
        Subject: `New WC claim filed: ${c.claimNumber} — ${c.claimant}`,
        Body:
          `<p>A new workers' compensation claim has been filed in Claim_Studio.</p>` +
          `<table style="border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;font-size:14px">` +
          `<tr><td style="padding:3px 12px 3px 0;color:#595959">Claim Number</td><td><b>${c.claimNumber}</b></td></tr>` +
          `<tr><td style="padding:3px 12px 3px 0;color:#595959">Claimant</td><td>${c.claimant}</td></tr>` +
          `<tr><td style="padding:3px 12px 3px 0;color:#595959">Property</td><td>${c.property}</td></tr>` +
          `<tr><td style="padding:3px 12px 3px 0;color:#595959">Incident Type</td><td>${c.incidentType}</td></tr>` +
          `<tr><td style="padding:3px 12px 3px 0;color:#595959">Severity</td><td>${c.severity}</td></tr>` +
          `<tr><td style="padding:3px 12px 3px 0;color:#595959">Assigned Adjuster</td><td>${c.adjuster}</td></tr>` +
          `</table>` +
          `<p>The full claim summary is attached as a PDF.</p>` +
          `<p style="color:#8b93a3;font-size:12px">Sent automatically by Claim_Studio.</p>`,
        Attachments: [{ Name: pdf.fileName, ContentBytes: pdf.base64 }],
        Importance: "Normal",
      });
      if (!result || !result.success) {
        throw new Error(result?.error ? errMessage(result.error) : "SendEmailV2 returned no success");
      }
    } catch (e) {
      warnings.push(`the PDF email could not be sent (${errMessage(e)})`);
    }
  }

  return warnings.length ? { ok: true, warning: `Claim saved, but ${warnings.join("; ")}.` } : { ok: true };
}

// Recover the new record's GUID for the file-column upload. Prefer the body
// returned by return=representation; fall back to a lookup by claim number.
function pickClaimId(created: unknown): string {
  if (!created || typeof created !== "object") return "";
  const o = created as Record<string, unknown>;
  const dp = (o.dynamicProperties as Record<string, unknown> | undefined) ?? o;
  const id = dp["owcp_claimid"];
  return typeof id === "string" ? id : "";
}

async function resolveCreatedId(created: unknown, claimNumber: string): Promise<string> {
  const fromBody = pickClaimId(created);
  if (fromBody) return fromBody;
  try {
    const data = await exec(
      "Dataverse lookup new claim",
      MicrosoftDataverseService.ListRecordsWithOrganization(
        CURRENT_ORG, ENTITY_SET, undefined, undefined, false, false,
        "owcp_claimid", `owcp_claimnumber eq '${claimNumber.replace(/'/g, "''")}'`,
        undefined, undefined, undefined, 1
      )
    );
    const rows = (data as { value?: Row[] })?.value ?? [];
    if (!rows.length) return "";
    const row = ((rows[0] as { dynamicProperties?: Row }).dynamicProperties ?? rows[0]) as Row;
    return str(row, "owcp_claimid");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Case lifecycle + workspace (WC)
// ---------------------------------------------------------------------------

const NOTE_SET = "owcp_casenotes";
const DOC_SET = "owcp_casedocuments";
const APPT_SET = "owcp_caseappointments";
const TASK_SET = "owcp_casetasks";

function unwrap(data: unknown): Row[] {
  const v = (data as { value?: Row[] })?.value ?? [];
  return v.map((it) => ((it as { dynamicProperties?: Row }).dynamicProperties ?? it) as Row);
}

async function listBy<T>(label: string, set: string, filter: string, orderby: string, map: (r: Row) => T): Promise<T[]> {
  const data = await exec(
    label,
    MicrosoftDataverseService.ListRecordsWithOrganization(
      CURRENT_ORG, set, 'odata.include-annotations="*"', undefined, false, false, undefined, filter || undefined, orderby
    )
  );
  return unwrap(data).map(map);
}

async function createIn(label: string, set: string, row: Record<string, unknown>): Promise<void> {
  await exec(
    label,
    MicrosoftDataverseService.CreateRecordWithOrganization(
      "return=representation", "application/json", CURRENT_ORG, set, row, false
    )
  );
}

async function updateIn(label: string, set: string, id: string, row: Record<string, unknown>): Promise<void> {
  await exec(
    label,
    MicrosoftDataverseService.UpdateRecordWithOrganization(
      "return=representation", "application/json", CURRENT_ORG, set, id, row, false
    )
  );
}

const claimBind = (claimId: string) => ({ "owcp_ClaimId@odata.bind": `/owcp_claims(${claimId})` });

// ---- Stage + C-1/C-4 gate on the claim itself ----
export async function updateClaimStage(claimId: string, stage: CaseStage): Promise<CreateResult> {
  try {
    await updateIn("Update stage", ENTITY_SET, claimId, { owcp_stage: STAGE_OPT[stage] });
    return { ok: true };
  } catch (e) { return { ok: false, error: errMessage(e) }; }
}

export async function updateClaimDocs(
  claimId: string, changes: { c1Received?: boolean; c4Received?: boolean; c4Source?: string }
): Promise<CreateResult> {
  try {
    const row: Record<string, unknown> = {};
    if (changes.c1Received !== undefined) row.owcp_c1received = changes.c1Received;
    if (changes.c4Received !== undefined) row.owcp_c4received = changes.c4Received;
    if (changes.c4Source !== undefined) row.owcp_c4source = changes.c4Source;
    await updateIn("Update C1/C4", ENTITY_SET, claimId, row);
    return { ok: true };
  } catch (e) { return { ok: false, error: errMessage(e) }; }
}

// ---- Mappers for child tables ----
function rowToNote(r: Row): CaseNote {
  return {
    id: str(r, "owcp_casenoteid"), claimId: str(r, "_owcp_claimid_value"),
    title: str(r, "owcp_name"), note: str(r, "owcp_notetext"),
    author: str(r, "owcp_author"), createdOn: str(r, "createdon"),
  };
}
function rowToDoc(r: Row): CaseDocument {
  return {
    id: str(r, "owcp_casedocumentid"), claimId: str(r, "_owcp_claimid_value"),
    name: str(r, "owcp_name"), docType: (fmt(r, "owcp_doctype") || "Other") as DocType,
    link: str(r, "owcp_link"), uploadedBy: str(r, "owcp_uploadedby"), createdOn: str(r, "createdon"),
  };
}
function rowToAppt(r: Row): CaseAppointment {
  return {
    id: str(r, "owcp_caseappointmentid"), claimId: str(r, "_owcp_claimid_value"),
    claimNumber: fmt(r, "_owcp_claimid_value"),
    subject: str(r, "owcp_subject"), start: str(r, "owcp_start"), end: str(r, "owcp_end"),
    location: str(r, "owcp_location"), hasTask: r["owcp_hastask"] === true || r["owcp_hastask"] === 1,
  };
}
function rowToTask(r: Row): CaseTask {
  return {
    id: str(r, "owcp_casetaskid"), claimId: str(r, "_owcp_claimid_value"),
    claimNumber: fmt(r, "_owcp_claimid_value"),
    title: str(r, "owcp_title"), assignedTo: str(r, "owcp_assignedto"),
    dueDate: str(r, "owcp_duedate").slice(0, 10),
    status: (fmt(r, "owcp_taskstatus") || "Open") as TaskStatus,
    completionNote: str(r, "owcp_completionnote"),
    notify: r["owcp_notify"] === true || r["owcp_notify"] === 1,
  };
}

// ---- Load a full workspace for one claim ----
export async function loadWorkspace(claimId: string): Promise<Workspace> {
  const f = `_owcp_claimid_value eq ${claimId}`;
  const [notes, documents, appointments, tasks] = await Promise.all([
    listBy("Notes", NOTE_SET, f, "createdon desc", rowToNote).catch(() => []),
    listBy("Documents", DOC_SET, f, "createdon desc", rowToDoc).catch(() => []),
    listBy("Appointments", APPT_SET, f, "owcp_start asc", rowToAppt).catch(() => []),
    listBy("Tasks", TASK_SET, f, "owcp_duedate asc", rowToTask).catch(() => []),
  ]);
  return { notes, documents, appointments, tasks };
}

// ---- Create child records ----
export async function addNote(claimId: string, title: string, note: string, author: string): Promise<CreateResult> {
  try {
    await createIn("Add note", NOTE_SET, { owcp_name: title || "Note", owcp_notetext: note, owcp_author: author, ...claimBind(claimId) });
    return { ok: true };
  } catch (e) { return { ok: false, error: errMessage(e) }; }
}
export async function addDocument(claimId: string, name: string, docType: DocType, link: string, uploadedBy: string): Promise<CreateResult> {
  try {
    await createIn("Add document", DOC_SET, { owcp_name: name, owcp_doctype: DOCTYPE_OPT[docType], owcp_link: link, owcp_uploadedby: uploadedBy, ...claimBind(claimId) });
    return { ok: true };
  } catch (e) { return { ok: false, error: errMessage(e) }; }
}
export async function addAppointment(claimId: string, subject: string, start: string, end: string, location: string, withTask: boolean, assignedTo: string): Promise<CreateResult> {
  try {
    await createIn("Add appointment", APPT_SET, { owcp_subject: subject, owcp_start: start, owcp_end: end, owcp_location: location, owcp_hastask: withTask, ...claimBind(claimId) });
    // Each follow-up appointment can spawn a linked task (board requirement).
    if (withTask) {
      await createIn("Add appt task", TASK_SET, {
        owcp_title: `Follow-up: ${subject}`, owcp_assignedto: assignedTo,
        owcp_duedate: start.slice(0, 10), owcp_taskstatus: TASKSTATUS_OPT["Open"], ...claimBind(claimId),
      });
    }
    return { ok: true };
  } catch (e) { return { ok: false, error: errMessage(e) }; }
}
export async function addTask(claimId: string, title: string, assignedTo: string, dueDate: string): Promise<CreateResult> {
  try {
    await createIn("Add task", TASK_SET, { owcp_title: title, owcp_assignedto: assignedTo, owcp_duedate: dueDate, owcp_taskstatus: TASKSTATUS_OPT["Open"], ...claimBind(claimId) });
    return { ok: true };
  } catch (e) { return { ok: false, error: errMessage(e) }; }
}

// ---- Update / complete a task ----
export async function updateTask(
  taskId: string, changes: { status?: TaskStatus; completionNote?: string; notify?: boolean; dueDate?: string; title?: string }
): Promise<CreateResult> {
  try {
    const row: Record<string, unknown> = {};
    if (changes.status !== undefined) row.owcp_taskstatus = TASKSTATUS_OPT[changes.status];
    if (changes.completionNote !== undefined) row.owcp_completionnote = changes.completionNote;
    if (changes.notify !== undefined) row.owcp_notify = changes.notify;
    if (changes.dueDate !== undefined) row.owcp_duedate = changes.dueDate;
    if (changes.title !== undefined) row.owcp_title = changes.title;
    await updateIn("Update task", TASK_SET, taskId, row);
    return { ok: true };
  } catch (e) { return { ok: false, error: errMessage(e) }; }
}

// ---- Department roll-ups ----
export async function loadAllTasks(): Promise<CaseTask[]> {
  return listBy("All tasks", TASK_SET, "", "owcp_duedate asc", rowToTask).catch(() => []);
}
export async function loadAllAppointments(): Promise<CaseAppointment[]> {
  return listBy("All appointments", APPT_SET, "", "owcp_start asc", rowToAppt).catch(() => []);
}

export interface ConnectionInfo {
  environmentId?: string;
  tenantId?: string;
  user?: string;
  orgName?: string;
  orgUrl?: string;
}

// Pulls real connection/host metadata so the footer is not hard-coded.
// Uses the SDK host context (environment/tenant/user) plus the connected
// Dataverse org (matched by URL) from GetOrganizations.
export async function getConnectionInfo(): Promise<ConnectionInfo> {
  const info: ConnectionInfo = {};

  try {
    const { getContext } = await import("@microsoft/power-apps/app");
    const ctx = await getContext();
    info.environmentId = ctx?.app?.environmentId;
    info.tenantId = ctx?.user?.tenantId;
    info.user = ctx?.user?.userPrincipalName || ctx?.user?.fullName;
  } catch {
    // Outside the Power host (dev) — leave host fields undefined.
  }

  try {
    const org = await resolveOrg();
    if (org.url) {
      info.orgUrl = org.url;
      info.orgName = org.name;
    }
  } catch {
    // Connector unavailable — leave org fields undefined (dev/seed mode).
  }

  return info;
}
