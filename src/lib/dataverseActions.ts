import { MicrosoftDataverseService } from "../generated";
import type { QueryRequest } from "../generated/models/MicrosoftDataverseModel";
import { CURRENT_ORG } from "./dataverseSchema";

type OperationResult<T> = { success: boolean; data: T; error?: unknown };

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const message = (e as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(e);
}

async function requireSuccess<T>(label: string, op: Promise<OperationResult<T>>): Promise<T> {
  const result = await op;
  if (!result || !result.success) {
    throw new Error(`${label} failed: ${result?.error ? errMessage(result.error) : "connector returned no success"}`);
  }
  return result.data;
}

export async function performUnboundAction<T = Record<string, unknown>>(
  actionName: string,
  item?: Record<string, unknown>
): Promise<T> {
  return requireSuccess(
    `Dataverse action ${actionName}`,
    MicrosoftDataverseService.PerformUnboundActionWithOrganization(CURRENT_ORG, actionName, item) as Promise<OperationResult<T>>
  );
}

export async function performBoundAction<T = Record<string, unknown>>(
  entityName: string,
  actionName: string,
  recordId: string,
  item?: Record<string, unknown>
): Promise<T> {
  return requireSuccess(
    `Dataverse bound action ${actionName}`,
    MicrosoftDataverseService.PerformBoundActionWithOrganization(
      CURRENT_ORG,
      entityName,
      actionName,
      recordId,
      item
    ) as Promise<OperationResult<T>>
  );
}

export async function predictWithAiBuilder<T = Record<string, unknown>>(
  modelId: string,
  item: Record<string, unknown>
): Promise<T> {
  return requireSuccess(
    `AI Builder prediction ${modelId}`,
    MicrosoftDataverseService.PredictV2(modelId, "return=representation", item) as Promise<OperationResult<T>>
  );
}

export async function getUnboundActionInputMetadata(actionName: string): Promise<Record<string, unknown>> {
  return requireSuccess(
    `Dataverse action metadata ${actionName}`,
    MicrosoftDataverseService.GetMetadataForUnboundActionInputWithOrganization(CURRENT_ORG, actionName)
  );
}

export async function invokeDataverseMcp(queryRequest: QueryRequest, sessionId?: string): Promise<void> {
  await requireSuccess(
    "Dataverse MCP invocation",
    MicrosoftDataverseService.InvokeMCP(sessionId, queryRequest) as Promise<OperationResult<void>>
  );
}