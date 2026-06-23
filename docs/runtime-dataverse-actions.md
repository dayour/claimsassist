# Runtime Dataverse Actions

Claim_Studio uses the generated Code Apps Dataverse connector as the runtime boundary for Power Platform work.

## Priority

1. Dataverse row operations through `MicrosoftDataverseService.*WithOrganization("current", ...)`.
2. Dataverse custom actions through `PerformUnboundActionWithOrganization` or `PerformBoundActionWithOrganization`.
3. AI Builder prediction through `PredictV2` when a model id is configured.
4. Dataverse MCP invocation through `InvokeMCP` only for scenarios that need that preview surface.
5. Local deterministic logic is a development fallback only.

## Current Runtime Hooks

| Workflow | Implementation | Configuration |
|---|---|---|
| Claim CRUD | `src/lib/dataverse.ts` | none |
| Workspace notes/docs/appointments/tasks | `src/lib/dataverse.ts` | none |
| Form Fill Assist | `src/lib/formFillAssist.ts` | `VITE_FORM_FILL_ASSIST_ACTION` or `VITE_AI_BUILDER_MODEL_ID` |
| Claim submitted automation | Dataverse workflow triggered by claim row/attachment changes | configured in Dataverse, outside the Code App |
| Claim PDF generation | Copilot Studio / Power Automate flow using the fillable PDF schema | `docs/claim-studio-pdf-template-schema.md` |

`VITE_FORM_FILL_ASSIST_ACTION` should name an unbound Dataverse custom action that accepts `{ input, description }` and returns draft fields such as category, severity, recommendedAction, bodyPart, adjuster, or reserveUsd.

`VITE_AI_BUILDER_MODEL_ID` should be the AI Builder model id used by the Dataverse connector `PredictV2` operation. This is the likely platform surface behind a human-friendly "Form Fill Assist" feature name when no custom action is present.

Claim-submitted email is intentionally not called from the Code App. The app saves the claim row and related workspace data in Dataverse; a separate Dataverse-triggered workflow handles PDF generation, outbound email, and notification.

## PDF Template Contract

The external claim PDF generator must use [claim-studio-pdf-template-schema.md](claim-studio-pdf-template-schema.md). The schema requires text boxes for claim overview, claimant details, incident details, classification, related records, appointments, documents, tasks, and signature fields. It also explicitly requires the first page to contain real claim content and to use the display label `Region` instead of the legacy logical name `owcp_property`.

Documents entered in the workspace are tracked as `owcp_casedocuments` metadata rows with `owcp_link` / location. Generated claim PDFs should be stored by the workflow as a Dataverse note attachment or SharePoint file and linked back to the claim/workspace.

## Audit Notes

- The generated connector already supports action metadata discovery, unbound actions, bound actions, AI Builder prediction, background operations, and Dataverse MCP operations.
- The app no longer imports a generated mail service or declares a mail connection in `power.config.json`.
- Direct browser calls to Dataverse Web API are intentionally avoided at runtime; local validation scripts may use Web API because they run outside the Code App host.
