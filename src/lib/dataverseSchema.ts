export const CURRENT_ORG = "current";

export const MODEL_DRIVEN_APP_NAME = "dystudio_wccases";
export const CLAIM_TABLE_LOGICAL_NAME = "owcp_claim";
export const CLAIM_ENTITY_SET = "owcp_claims";

export const ANNOTATION_ENTITY_SET = "annotations";
export const NOTE_ENTITY_SET = "owcp_casenotes";
export const DOCUMENT_ENTITY_SET = "owcp_casedocuments";
export const APPOINTMENT_ENTITY_SET = "owcp_caseappointments";
export const TASK_ENTITY_SET = "owcp_casetasks";

export const ODATA_INCLUDE_ANNOTATIONS = 'odata.include-annotations="*"';

export const CLAIM_SELECT = [
  "owcp_claimid",
  "owcp_claimnumber",
  "owcp_claimant",
  "owcp_property",
  "owcp_department",
  "owcp_incidenttype",
  "owcp_bodypart",
  "owcp_status",
  "owcp_severity",
  "owcp_adjuster",
  "owcp_dateofinjury",
  "owcp_datereported",
  "owcp_reserveusd",
  "owcp_stage",
  "owcp_c1received",
  "owcp_c4received",
  "owcp_c4source",
  "owcp_description",
  "owcp_classified",
  "owcp_classifierconfidence",
  "owcp_classifiermodel",
  "owcp_recommendedaction",
].join(",");

export const NOTE_SELECT = [
  "owcp_casenoteid",
  "_owcp_claimid_value",
  "owcp_name",
  "owcp_notetext",
  "owcp_author",
  "createdon",
].join(",");

export const DOCUMENT_SELECT = [
  "owcp_casedocumentid",
  "_owcp_claimid_value",
  "owcp_name",
  "owcp_doctype",
  "owcp_link",
  "owcp_uploadedby",
  "createdon",
].join(",");

export const APPOINTMENT_SELECT = [
  "owcp_caseappointmentid",
  "_owcp_claimid_value",
  "owcp_subject",
  "owcp_start",
  "owcp_end",
  "owcp_location",
  "owcp_hastask",
].join(",");

export const TASK_SELECT = [
  "owcp_casetaskid",
  "_owcp_claimid_value",
  "owcp_title",
  "owcp_assignedto",
  "owcp_duedate",
  "owcp_taskstatus",
  "owcp_completionnote",
  "owcp_notify",
].join(",");

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDataverseGuid(value: string): boolean {
  return GUID_RE.test(value);
}

export function dataverseTableUrl(orgUrl?: string, environmentId?: string): string | null {
  if (orgUrl) {
    return `${orgUrl.replace(/\/$/, "")}/main.aspx?appname=${MODEL_DRIVEN_APP_NAME}&pagetype=entitylist&etn=${CLAIM_TABLE_LOGICAL_NAME}`;
  }
  if (environmentId) {
    return `https://make.powerapps.com/environments/${environmentId}/entities/${CLAIM_TABLE_LOGICAL_NAME}/data`;
  }
  return null;
}

export function dataverseRecordUrl(recordId: string, orgUrl?: string): string | null {
  if (!orgUrl || !isDataverseGuid(recordId)) return null;
  const base = orgUrl.replace(/\/$/, "");
  return `${base}/main.aspx?appname=${MODEL_DRIVEN_APP_NAME}&pagetype=entityrecord&etn=${CLAIM_TABLE_LOGICAL_NAME}&id=${recordId}`;
}