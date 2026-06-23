# Claim_Studio PDF Template Schema

This document is the canonical schema for PDFs generated outside the Code App, such as by a Copilot Studio agent or Dataverse-triggered workflow. It is intentionally documentation-only: the Code App should save claim data to Dataverse, and the external workflow should generate the PDF from this contract.

## Agent Instruction

Use this instruction with the schema below:

```text
Generate a fillable PDF using this schema exactly. Do not invent sections. Do not use the label Property; use Region. The first page must contain Claim Overview, Claimant Details, and Incident Details. Do not create a mostly blank cover page. Use text boxes for all fields and multi-line text boxes for description, recommended action, notes, and completion notes. Repeat child records as compact tables. Continue overflow on the next page only when content does not fit.
```

## Schema

```json
{
  "templateId": "claim_studio_incident_report_v1",
  "title": "Claim_Studio Incident Report",
  "pageSize": "Letter",
  "orientation": "portrait",
  "outputFileNamePattern": "Claim_Studio_{claim.claimNumber}.pdf",
  "branding": {
    "brandName": "Claim_Studio",
    "subtitle": "Workers' Compensation Incident Report",
    "confidentialityLabel": "CONFIDENTIAL"
  },
  "dataSource": {
    "primaryTable": "owcp_claims",
    "primaryIdField": "owcp_claimid",
    "childTables": {
      "notes": "owcp_casenotes",
      "documents": "owcp_casedocuments",
      "appointments": "owcp_caseappointments",
      "tasks": "owcp_casetasks"
    }
  },
  "sections": [
    {
      "id": "claim_overview",
      "title": "Claim Overview",
      "fields": [
        { "name": "claim.claimNumber", "label": "Claim Number", "type": "textbox", "dataverseField": "owcp_claimnumber", "required": true },
        { "name": "claim.status", "label": "Claim Status", "type": "textbox", "dataverseField": "owcp_status", "required": true },
        { "name": "claim.stage", "label": "Lifecycle Stage", "type": "textbox", "dataverseField": "owcp_stage" },
        { "name": "claim.createdOn", "label": "Created On", "type": "textbox", "dataverseField": "createdon" },
        { "name": "claim.modifiedOn", "label": "Last Modified", "type": "textbox", "dataverseField": "modifiedon" },
        { "name": "claim.claimId", "label": "Claim ID", "type": "textbox", "dataverseField": "owcp_claimid" }
      ]
    },
    {
      "id": "claimant_details",
      "title": "Claimant Details",
      "fields": [
        { "name": "claim.claimant", "label": "Claimant Name", "type": "textbox", "dataverseField": "owcp_claimant", "required": true },
        { "name": "claim.department", "label": "Department", "type": "textbox", "dataverseField": "owcp_department", "required": true },
        {
          "name": "claim.region",
          "label": "Region",
          "type": "textbox",
          "dataverseField": "owcp_property",
          "required": true,
          "notes": "Display label is Region; legacy Dataverse logical field is owcp_property."
        },
        { "name": "claim.adjuster", "label": "Assigned Adjuster", "type": "textbox", "dataverseField": "owcp_adjuster" }
      ]
    },
    {
      "id": "incident_details",
      "title": "Incident Details",
      "fields": [
        { "name": "claim.dateOfInjury", "label": "Date of Injury", "type": "textbox", "dataverseField": "owcp_dateofinjury", "required": true },
        { "name": "claim.dateReported", "label": "Date Reported", "type": "textbox", "dataverseField": "owcp_datereported" },
        { "name": "claim.incidentType", "label": "Incident Type", "type": "textbox", "dataverseField": "owcp_incidenttype" },
        { "name": "claim.bodyPart", "label": "Body Part Affected", "type": "textbox", "dataverseField": "owcp_bodypart" },
        { "name": "claim.severity", "label": "Severity", "type": "textbox", "dataverseField": "owcp_severity" },
        { "name": "claim.description", "label": "Incident Description", "type": "textarea", "dataverseField": "owcp_description", "required": true, "minHeight": 90 }
      ]
    },
    {
      "id": "intake_documents",
      "title": "Intake Documents",
      "fields": [
        { "name": "claim.c1Received", "label": "C-1 Received", "type": "textbox", "dataverseField": "owcp_c1received" },
        { "name": "claim.c4Received", "label": "C-4 Received", "type": "textbox", "dataverseField": "owcp_c4received" },
        { "name": "claim.c4Source", "label": "C-4 Source", "type": "textbox", "dataverseField": "owcp_c4source" },
        { "name": "claim.reserveUsd", "label": "Reserve USD", "type": "textbox", "dataverseField": "owcp_reserveusd" }
      ]
    },
    {
      "id": "classification",
      "title": "Classification",
      "fields": [
        { "name": "classification.isClassified", "label": "Classification Status", "type": "textbox", "dataverseField": "owcp_classified" },
        { "name": "classification.category", "label": "Classification Category", "type": "textbox", "dataverseField": "owcp_incidenttype" },
        { "name": "classification.severity", "label": "Classification Severity", "type": "textbox", "dataverseField": "owcp_severity" },
        { "name": "classification.confidence", "label": "Classifier Confidence", "type": "textbox", "dataverseField": "owcp_classifierconfidence" },
        { "name": "classification.model", "label": "Classifier Model", "type": "textbox", "dataverseField": "owcp_classifiermodel" },
        { "name": "classification.recommendedAction", "label": "Recommended Action", "type": "textarea", "dataverseField": "owcp_recommendedaction", "minHeight": 70 }
      ]
    },
    {
      "id": "related_records_summary",
      "title": "Related Records Summary",
      "fields": [
        { "name": "related.notesCount", "label": "Case Notes Count", "type": "textbox", "sourceTable": "owcp_casenotes" },
        { "name": "related.documentsCount", "label": "Case Documents Count", "type": "textbox", "sourceTable": "owcp_casedocuments" },
        { "name": "related.appointmentsCount", "label": "Appointments Count", "type": "textbox", "sourceTable": "owcp_caseappointments" },
        { "name": "related.tasksCount", "label": "Case Tasks Count", "type": "textbox", "sourceTable": "owcp_casetasks" }
      ]
    },
    {
      "id": "note_rows",
      "title": "Case Notes",
      "repeat": true,
      "sourceTable": "owcp_casenotes",
      "lookupToClaim": "owcp_ClaimId",
      "fields": [
        { "name": "notes[].title", "label": "Title", "type": "textbox", "dataverseField": "owcp_name" },
        { "name": "notes[].note", "label": "Note", "type": "textarea", "dataverseField": "owcp_notetext" },
        { "name": "notes[].author", "label": "Author", "type": "textbox", "dataverseField": "owcp_author" },
        { "name": "notes[].createdOn", "label": "Created On", "type": "textbox", "dataverseField": "createdon" }
      ]
    },
    {
      "id": "document_rows",
      "title": "Documents",
      "repeat": true,
      "sourceTable": "owcp_casedocuments",
      "lookupToClaim": "owcp_ClaimId",
      "fields": [
        { "name": "documents[].name", "label": "Document Name", "type": "textbox", "dataverseField": "owcp_name" },
        { "name": "documents[].type", "label": "Document Type", "type": "textbox", "dataverseField": "owcp_doctype" },
        { "name": "documents[].link", "label": "Link / Location", "type": "textbox", "dataverseField": "owcp_link" },
        { "name": "documents[].uploadedBy", "label": "Uploaded By", "type": "textbox", "dataverseField": "owcp_uploadedby" },
        { "name": "documents[].createdOn", "label": "Created On", "type": "textbox", "dataverseField": "createdon" }
      ]
    },
    {
      "id": "appointment_rows",
      "title": "Appointments",
      "repeat": true,
      "sourceTable": "owcp_caseappointments",
      "lookupToClaim": "owcp_ClaimId",
      "fields": [
        { "name": "appointments[].subject", "label": "Subject", "type": "textbox", "dataverseField": "owcp_subject" },
        { "name": "appointments[].start", "label": "Start", "type": "textbox", "dataverseField": "owcp_start" },
        { "name": "appointments[].end", "label": "End", "type": "textbox", "dataverseField": "owcp_end" },
        { "name": "appointments[].location", "label": "Location", "type": "textbox", "dataverseField": "owcp_location" },
        { "name": "appointments[].hasTask", "label": "Has Linked Task", "type": "textbox", "dataverseField": "owcp_hastask" }
      ]
    },
    {
      "id": "task_rows",
      "title": "Tasks",
      "repeat": true,
      "sourceTable": "owcp_casetasks",
      "lookupToClaim": "owcp_ClaimId",
      "fields": [
        { "name": "tasks[].title", "label": "Task Title", "type": "textbox", "dataverseField": "owcp_title" },
        { "name": "tasks[].assignedTo", "label": "Assigned To", "type": "textbox", "dataverseField": "owcp_assignedto" },
        { "name": "tasks[].dueDate", "label": "Due Date", "type": "textbox", "dataverseField": "owcp_duedate" },
        { "name": "tasks[].status", "label": "Task Status", "type": "textbox", "dataverseField": "owcp_taskstatus" },
        { "name": "tasks[].completionNote", "label": "Completion Note", "type": "textarea", "dataverseField": "owcp_completionnote" },
        { "name": "tasks[].notify", "label": "Notify", "type": "textbox", "dataverseField": "owcp_notify" }
      ]
    },
    {
      "id": "authorizations",
      "title": "Authorizations",
      "fields": [
        { "name": "signatures.claimant", "label": "Claimant Signature / Date", "type": "textbox" },
        { "name": "signatures.supervisor", "label": "Supervisor Signature / Date", "type": "textbox" },
        { "name": "signatures.hr", "label": "HR Representative Signature / Date", "type": "textbox" },
        { "name": "signatures.adjuster", "label": "Adjuster Signature / Date", "type": "textbox" },
        { "name": "signatures.approver", "label": "Authorized Approver Signature / Date", "type": "textbox" }
      ]
    }
  ],
  "layoutRules": {
    "doNotLeaveFirstPageBlank": true,
    "startFirstContentSectionOnPageOne": true,
    "useTextboxesForAllClaimFields": true,
    "useTextareaForLongNarrativeFields": true,
    "repeatChildRowsAsTables": true,
    "continueOverflowOnNextPage": true,
    "footerEveryPage": true,
    "footerTextPattern": "Claim_Studio | {claim.claimNumber} | Claimant: {claim.claimant} | Dept: {claim.department} | Region: {claim.region} | Generated: {generatedUtc}"
  }
}
```

## Attachment Behavior

- User-added documents in the workspace are metadata rows in `owcp_casedocuments`; the actual document is represented by `owcp_link` / location.
- Generated claim PDFs should be stored by the external workflow as a Dataverse note attachment or SharePoint file, then linked back to the claim/workspace.
- The template must use `Region` in all display text, even though the Dataverse logical column remains `owcp_property`.