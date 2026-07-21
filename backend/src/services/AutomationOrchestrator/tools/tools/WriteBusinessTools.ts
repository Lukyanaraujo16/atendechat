import {
  defineTool,
  makeToolResult,
  ToolInputSchema,
  ToolOutputSchema,
  ToolResult
} from "../contracts/ToolContract";
import { runOperationViaRuntime } from "../operations/AutomationOperationRuntime";
import {
  AddContactTagOperation,
  ContactUpdateAllowedFieldsOperation,
  InternalNoteCreateOperation,
  RemoveContactTagOperation,
  TicketTransferOperation
} from "../operations/domainOperations";
import { AutomationOperationContract } from "../operations/contracts/OperationContract";
import { diffOperationInternalVsModel } from "../operations/OperationModelResultAdapter";

const writeOutput: ToolOutputSchema = {
  type: "object",
  additionalProperties: true,
  fields: [
    { name: "operationStatus", type: "string", required: true },
    { name: "preview", type: "object", required: false },
    { name: "changedFields", type: "array", required: false },
    { name: "dryRun", type: "boolean", required: false },
    { name: "summary", type: "string", required: false }
  ]
};

function writeToolBase(partial: {
  id: string;
  name: string;
  description: string;
  category: "contact" | "ticket" | "tag" | "note" | "system";
  capabilities: Array<
    | "tool.write"
    | "contact.write"
    | "ticket.write"
    | "tag.write"
    | "note.write"
  >;
  riskLevel: "low" | "medium" | "high";
  inputSchema: ToolInputSchema;
  requiresConfirmation?: "never" | "admin_only" | "policy_based";
}) {
  return {
    id: partial.id,
    name: partial.name,
    version: "1.0.0",
    category: partial.category,
    capabilities: partial.capabilities,
    description: partial.description,
    riskLevel: partial.riskLevel,
    sideEffectType: "database_write" as const,
    supportsObserve: false,
    supportsShadow: false,
    supportsActive: true,
    exposeToModel: false,
    experimental: false,
    requiresConfirmation: partial.requiresConfirmation || "never",
    requiredPermissions: ["aiTools.executeWrite"],
    requiredFeatures: [],
    idempotencyPolicy: {
      type: "request" as const,
      persistentUniqueness: true
    },
    inputSchema: partial.inputSchema,
    outputSchema: writeOutput,
    tags: ["write", "2.1c", "operation-runtime"],
    owner: "atendechat.tools",
    timeoutPolicy: { timeoutMs: 20000 },
    rateLimitPolicy: {
      maxCalls: 30,
      windowSeconds: 60,
      scope: "company" as const
    },
    // Marca Tools que sempre passam pelo Operation Runtime
    metadata: { operationRuntime: true }
  };
}

function operationToToolResult(
  opResult: Awaited<ReturnType<typeof runOperationViaRuntime>>,
  toolId: string
): ToolResult {
  const statusMap: Record<string, ToolResult["status"]> = {
    success: "success",
    failure: "failure",
    denied: "denied",
    waiting_confirmation: "waiting_confirmation",
    dry_run: "success",
    preview: "success",
    conflict: "failure",
    rolled_back: "failure"
  };

  const data = {
    operationStatus: opResult.status,
    preview: opResult.preview,
    before: opResult.before,
    after: opResult.after,
    changedFields: opResult.changedFields,
    dryRun: opResult.metrics.dryRun,
    previewOnly: opResult.metrics.previewOnly,
    transaction: opResult.transaction,
    rollback: opResult.rollback,
    summary: opResult.preview?.summary || opResult.status,
    operationData: opResult.data,
    modelResult: opResult.modelResult,
    resultDiff: diffOperationInternalVsModel(opResult, opResult.modelResult)
  };

  return makeToolResult({
    status: statusMap[opResult.status] || "failure",
    data,
    displayData: {
      operationStatus: opResult.status,
      summary: data.summary,
      dryRun: data.dryRun,
      changedFields: opResult.changedFields,
      preview: opResult.preview,
      modelResult: opResult.modelResult
    },
    warnings: opResult.warnings,
    errors: opResult.errors.map(e => ({
      code: e.code,
      type: e.type as ToolResult["errors"][0]["type"],
      message: e.message,
      retryable: e.retryable,
      details: e.details
    })),
    confirmationStatus:
      opResult.status === "waiting_confirmation" ? "pending" : "none",
    sideEffectCommitted:
      opResult.status === "success" && !opResult.metrics.dryRun,
    modelPayload: {
      summary: data.summary,
      operation: toolId,
      changes: opResult.modelResult.changes,
      dryRun: data.dryRun,
      status: opResult.modelResult.status
    },
    logs: [
      `operation:${opResult.status}`,
      opResult.metrics.dryRun ? "dryRun" : "execute",
      `changed:${opResult.changedFields.length}`
    ],
    metrics: {
      durationMs: opResult.metrics.durationMs,
      attempts: 1,
      timedOut: false,
      retries: 0,
      rolledBack: opResult.rollback.succeeded
    }
  });
}

function defineWriteTool(
  toolPartial: Parameters<typeof writeToolBase>[0],
  operation: AutomationOperationContract
) {
  return defineTool(writeToolBase(toolPartial), {
    validateExecutionContext: ctx => {
      if (!ctx.companyId) throw new Error("TOOL_TENANT: companyId_required");
    },
    execute: async (ctx, input) => {
      const dryRun = input.dryRun === true;
      const previewOnly = input.previewOnly === true;
      const confirmed =
        input.confirmed === true ||
        ctx.metadata?.confirmationStatus === "approved";

      // Admin tester: escrita real exige executeWrite explícito no input
      if (
        ctx.source === "admin_test" &&
        !dryRun &&
        !previewOnly &&
        input.execute !== true
      ) {
        // força dry-run seguro se não pediu execute
        const opResult = await runOperationViaRuntime({
          operation,
          toolCtx: ctx,
          input,
          dryRun: true,
          previewOnly: false,
          confirmed: false
        });
        const result = operationToToolResult(opResult, toolPartial.id);
        result.warnings = [
          ...(result.warnings || []),
          "admin_test_forced_dry_run_without_execute"
        ];
        return result;
      }

      const opResult = await runOperationViaRuntime({
        operation,
        toolCtx: ctx,
        input,
        dryRun,
        previewOnly,
        confirmed
      });
      return operationToToolResult(opResult, toolPartial.id);
    },
    sanitizeInputForAudit: input => ({
      ...input,
      note:
        typeof input.note === "string" ? input.note.slice(0, 80) : input.note,
      fields: input.fields
    }),
    sanitizeOutputForAudit: output => ({
      operationStatus: output.operationStatus,
      summary: output.summary,
      dryRun: output.dryRun,
      changedFieldCount: Array.isArray(output.changedFields)
        ? output.changedFields.length
        : 0
    })
  });
}

export const ContactUpdateAllowedFieldsTool = defineWriteTool(
  {
    id: "contact.update_allowed_fields",
    name: "contact.update_allowed_fields",
    description: "Atualiza name/email/notes do contato via Operation Runtime.",
    category: "contact",
    capabilities: ["tool.write", "contact.write"],
    riskLevel: "low",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      fields: [
        { name: "contactId", type: "number", required: true, minimum: 1 },
        { name: "fields", type: "object", required: false },
        { name: "name", type: "string", maxLength: 255 },
        { name: "email", type: "string", maxLength: 255 },
        { name: "notes", type: "string", maxLength: 2000 },
        { name: "dryRun", type: "boolean" },
        { name: "previewOnly", type: "boolean" },
        { name: "confirmed", type: "boolean" },
        { name: "execute", type: "boolean" }
      ]
    }
  },
  ContactUpdateAllowedFieldsOperation
);

export const AddContactTagTool = defineWriteTool(
  {
    id: "add.contact.tag",
    name: "add.contact.tag",
    description: "Adiciona tag ao contato (ticket mais recente).",
    category: "tag",
    capabilities: ["tool.write", "tag.write", "contact.write"],
    riskLevel: "low",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      fields: [
        { name: "contactId", type: "number", required: true, minimum: 1 },
        { name: "tagId", type: "number", required: true, minimum: 1 },
        { name: "dryRun", type: "boolean" },
        { name: "previewOnly", type: "boolean" },
        { name: "confirmed", type: "boolean" },
        { name: "execute", type: "boolean" }
      ]
    }
  },
  AddContactTagOperation
);

export const RemoveContactTagTool = defineWriteTool(
  {
    id: "remove.contact.tag",
    name: "remove.contact.tag",
    description: "Remove tag dos tickets do contato.",
    category: "tag",
    capabilities: ["tool.write", "tag.write", "contact.write"],
    riskLevel: "low",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      fields: [
        { name: "contactId", type: "number", required: true, minimum: 1 },
        { name: "tagId", type: "number", required: true, minimum: 1 },
        { name: "dryRun", type: "boolean" },
        { name: "previewOnly", type: "boolean" },
        { name: "confirmed", type: "boolean" },
        { name: "execute", type: "boolean" }
      ]
    }
  },
  RemoveContactTagOperation
);

export const TicketTransferTool = defineWriteTool(
  {
    id: "ticket.transfer",
    name: "ticket.transfer",
    description: "Transfere ticket de fila/responsável (requer confirmação).",
    category: "ticket",
    capabilities: ["tool.write", "ticket.write"],
    riskLevel: "medium",
    requiresConfirmation: "admin_only",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      fields: [
        { name: "ticketId", type: "number", required: true, minimum: 1 },
        { name: "queueId", type: "number", minimum: 1 },
        { name: "userId", type: "number", minimum: 1 },
        { name: "dryRun", type: "boolean" },
        { name: "previewOnly", type: "boolean" },
        { name: "confirmed", type: "boolean" },
        { name: "execute", type: "boolean" }
      ]
    }
  },
  TicketTransferOperation
);

export const InternalNoteCreateTool = defineWriteTool(
  {
    id: "internal.note.create",
    name: "internal.note.create",
    description: "Cria nota interna no ticket.",
    category: "note",
    capabilities: ["tool.write", "note.write"],
    riskLevel: "low",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      fields: [
        { name: "ticketId", type: "number", required: true, minimum: 1 },
        {
          name: "note",
          type: "string",
          required: true,
          maxLength: 2000
        },
        { name: "dryRun", type: "boolean" },
        { name: "previewOnly", type: "boolean" },
        { name: "confirmed", type: "boolean" },
        { name: "execute", type: "boolean" }
      ]
    }
  },
  InternalNoteCreateOperation
);

export const WRITE_TOOLS = [
  ContactUpdateAllowedFieldsTool,
  AddContactTagTool,
  RemoveContactTagTool,
  TicketTransferTool,
  InternalNoteCreateTool
];
