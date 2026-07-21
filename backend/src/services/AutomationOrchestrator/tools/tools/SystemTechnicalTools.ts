import {
  defineTool,
  makeToolResult,
  ToolInputSchema,
  ToolOutputSchema
} from "../contracts/ToolContract";
import { sanitizeContextSummary } from "../ToolExecutionContext";
import { toolRegistrySize, listTools } from "../ToolRegistry";
import { evaluateToolPolicy } from "../AutomationToolPolicyEngine";

const echoInput: ToolInputSchema = {
  type: "object",
  additionalProperties: false,
  fields: [
    {
      name: "message",
      type: "string",
      required: true,
      description: "Texto a ecoar",
      maxLength: 200
    }
  ]
};

const echoOutput: ToolOutputSchema = {
  type: "object",
  additionalProperties: false,
  fields: [
    { name: "echo", type: "string", required: true },
    { name: "length", type: "number", required: true }
  ]
};

/** Tool técnica: valida schema, runtime, auditoria e output. */
export const SystemEchoTool = defineTool(
  {
    id: "system.echo",
    name: "system.echo",
    version: "1.0.0",
    category: "system",
    capabilities: ["tool.read", "tool.internal"],
    description: "Echo técnico para validar Tool Runtime (sem side effect).",
    riskLevel: "read_only",
    sideEffectType: "none",
    supportsObserve: false,
    supportsShadow: true,
    supportsActive: true,
    exposeToModel: false,
    experimental: false,
    requiredPermissions: ["aiTools.test"],
    requiredFeatures: [],
    inputSchema: echoInput,
    outputSchema: echoOutput,
    tags: ["technical", "validation"],
    owner: "atendechat.tools",
    timeoutPolicy: { timeoutMs: 3000 },
    rateLimitPolicy: {
      maxCalls: 30,
      windowSeconds: 60,
      scope: "company"
    }
  },
  {
    supportsDiscovery: () => true,
    validateExecutionContext: ctx => {
      if (!ctx.companyId) {
        throw new Error("TOOL_TENANT: companyId_required");
      }
    },
    execute: async (_ctx, input) => {
      const message = String(input.message || "");
      return makeToolResult({
        status: "success",
        data: { echo: message, length: message.length },
        displayData: { echo: message, length: message.length },
        logs: ["echo:ok"]
      });
    },
    sanitizeInputForAudit: input => ({
      message:
        typeof input.message === "string"
          ? input.message.slice(0, 200)
          : undefined
    })
  }
);

const contextOutput: ToolOutputSchema = {
  type: "object",
  additionalProperties: true,
  fields: [
    { name: "companyId", type: "number", required: true },
    { name: "controlMode", type: "string", required: true },
    { name: "source", type: "string", required: true }
  ]
};

/** Tool técnica: resumo sanitizado do contexto. */
export const SystemContextSummaryTool = defineTool(
  {
    id: "system.context_summary",
    name: "system.context_summary",
    version: "1.0.0",
    category: "system",
    capabilities: ["tool.read", "tool.internal"],
    description:
      "Retorna resumo sanitizado do ToolExecutionContext (sem secrets).",
    riskLevel: "read_only",
    sideEffectType: "none",
    supportsShadow: true,
    supportsActive: true,
    exposeToModel: false,
    requiredPermissions: ["aiTools.test"],
    inputSchema: {
      type: "object",
      fields: [],
      additionalProperties: false
    },
    outputSchema: contextOutput,
    tags: ["technical", "validation"],
    owner: "atendechat.tools",
    timeoutPolicy: { timeoutMs: 3000 }
  },
  {
    execute: async ctx => {
      const summary = sanitizeContextSummary(ctx);
      return makeToolResult({
        status: "success",
        data: summary,
        displayData: summary,
        logs: ["context_summary:ok"]
      });
    }
  }
);

const healthOutput: ToolOutputSchema = {
  type: "object",
  additionalProperties: false,
  fields: [
    { name: "runtime", type: "string", required: true },
    { name: "registryCount", type: "number", required: true },
    { name: "policyEngine", type: "string", required: true },
    { name: "ok", type: "boolean", required: true }
  ]
};

/** Tool técnica: health check de Runtime/Registry/Policy. */
export const SystemHealthCheckTool = defineTool(
  {
    id: "system.health_check",
    name: "system.health_check",
    version: "1.0.0",
    category: "system",
    capabilities: ["tool.read", "tool.internal"],
    description: "Valida Runtime, Registry e Policy Engine.",
    riskLevel: "read_only",
    sideEffectType: "none",
    supportsShadow: true,
    supportsActive: true,
    exposeToModel: false,
    requiredPermissions: ["aiTools.test"],
    inputSchema: {
      type: "object",
      fields: [],
      additionalProperties: false
    },
    outputSchema: healthOutput,
    tags: ["technical", "validation"],
    owner: "atendechat.tools",
    timeoutPolicy: { timeoutMs: 3000 }
  },
  {
    execute: async ctx => {
      const count = toolRegistrySize();
      const sample = listTools({ includeExperimental: true })[0];
      let policyEngine = "ok";
      if (sample) {
        try {
          evaluateToolPolicy({
            manifest: sample,
            ctx: {
              ...ctx,
              // força avaliação sem executar
              controlMode: "observe"
            }
          });
        } catch {
          policyEngine = "error";
        }
      }
      const data = {
        runtime: "ok",
        registryCount: count,
        policyEngine,
        ok: count > 0 && policyEngine === "ok"
      };
      return makeToolResult({
        status: "success",
        data,
        displayData: data,
        logs: ["health_check:ok"]
      });
    }
  }
);
