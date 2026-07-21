import {
  AUTOMATION_TOOL_RUNTIME_VERSION,
  AUTOMATION_TOOL_DEFAULT_CAPABILITIES
} from "../../../../config/automationToolConstants";
import {
  defineTool,
  makeToolResult,
  ToolInputSchema,
  ToolOutputSchema,
  ToolResult
} from "../contracts/ToolContract";
import {
  queryContactByIdForTool,
  queryContactsForTool,
  queryQueuesForTool,
  queryTicketByIdForTool,
  queryTicketsForTool,
  queryUsersForTool
} from "../queries/readDomainQueries";
import { listTools } from "../ToolRegistry";
import { resolveToolPagination } from "../toolPagination";
import { getToolCacheStore, buildToolCacheKey } from "../ToolCache";
import SearchKnowledgeChunksService from "../../../KnowledgeBaseService/SearchKnowledgeChunksService";
import GetAutomationExecutionService from "../../GetAutomationExecutionService";

const KNOWLEDGE_FEATURE = "automation.knowledge_base";

const paginationFields = [
  {
    name: "limit",
    type: "number" as const,
    required: false,
    description: "Máx. 50",
    minimum: 1,
    maximum: 50
  },
  {
    name: "offset",
    type: "number" as const,
    required: false,
    minimum: 0
  }
];

const listOutput: ToolOutputSchema = {
  type: "object",
  additionalProperties: true,
  fields: [
    { name: "items", type: "array", required: true },
    { name: "count", type: "number", required: true },
    { name: "hasMore", type: "boolean", required: true },
    { name: "summary", type: "string", required: false }
  ]
};

const itemOutput: ToolOutputSchema = {
  type: "object",
  additionalProperties: true,
  fields: [
    { name: "item", type: "object", required: false },
    { name: "found", type: "boolean", required: true },
    { name: "summary", type: "string", required: false }
  ]
};

function readToolBase(partial: {
  id: string;
  name: string;
  description: string;
  category: "system" | "contact" | "ticket" | "queue" | "user" | "knowledge" | "future";
  capabilities: Array<
    | "tool.read"
    | "tool.internal"
    | "contact.read"
    | "ticket.read"
    | "queue.read"
    | "user.read"
  >;
  requiredPermissions: string[];
  requiredFeatures?: string[];
  inputSchema: ToolInputSchema;
  outputSchema: ToolOutputSchema;
  sideEffectType?: "none" | "database_read";
  tags?: string[];
}) {
  return {
    id: partial.id,
    name: partial.name,
    version: "1.0.0",
    category: partial.category,
    capabilities: partial.capabilities,
    description: partial.description,
    riskLevel: "read_only" as const,
    sideEffectType: partial.sideEffectType || ("database_read" as const),
    supportsObserve: false,
    supportsShadow: true,
    supportsActive: true,
    exposeToModel: true,
    experimental: false,
    requiredPermissions: partial.requiredPermissions,
    requiredFeatures: partial.requiredFeatures || [],
    inputSchema: partial.inputSchema,
    outputSchema: partial.outputSchema,
    tags: ["read", "2.1b", ...(partial.tags || [])],
    owner: "atendechat.tools",
    timeoutPolicy: { timeoutMs: 8000 },
    rateLimitPolicy: {
      maxCalls: 60,
      windowSeconds: 60,
      scope: "company" as const
    }
  };
}

function successList(
  items: Array<Record<string, unknown>>,
  count: number,
  hasMore: boolean,
  summary: string,
  cacheHit = false
) {
  const data = { items, count, hasMore, summary };
  return makeToolResult({
    status: "success",
    data,
    displayData: data,
    metrics: {
      durationMs: 0,
      attempts: 1,
      timedOut: false,
      retries: 0,
      rolledBack: false
    },
    logs: [
      `resultCount:${items.length}`,
      cacheHit ? "cacheHit" : "cacheMiss"
    ]
  });
}

/** Anexa métricas de leitura no runtime via data flags. */
export function annotateReadMetrics(
  result: ToolResult,
  opts: { resultCount: number; cacheHit?: boolean }
): ToolResult {
  return {
    ...result,
    metrics: {
      ...result.metrics,
      resultCount: opts.resultCount,
      emptyResult: opts.resultCount === 0,
      cacheHit: opts.cacheHit === true,
      cacheMiss: opts.cacheHit !== true
    },
    data: {
      ...result.data,
      __readMeta: {
        resultCount: opts.resultCount,
        emptyResult: opts.resultCount === 0,
        cacheHit: opts.cacheHit === true
      }
    },
    modelPayload: {
      items: result.data.items,
      item: result.data.item,
      count: result.data.count,
      hasMore: result.data.hasMore,
      summary: result.data.summary,
      found: result.data.found
    }
  };
}

export const SystemInfoTool = defineTool(
  readToolBase({
    id: "system.info",
    name: "system.info",
    description: "Informações sanitizadas do runtime de Tools.",
    category: "system",
    capabilities: ["tool.read", "tool.internal"],
    requiredPermissions: ["aiTools.executeRead"],
    sideEffectType: "none",
    inputSchema: { type: "object", fields: [], additionalProperties: false },
    outputSchema: {
      type: "object",
      additionalProperties: true,
      fields: [
        { name: "item", type: "object", required: true },
        { name: "summary", type: "string", required: true }
      ]
    },
    tags: ["system"]
  }),
  {
    execute: async ctx => {
      const tools = listTools({ includeExperimental: true });
      const item = {
        runtimeVersion: AUTOMATION_TOOL_RUNTIME_VERSION,
        controlMode: ctx.controlMode,
        source: ctx.source,
        companyId: ctx.companyId,
        capabilities: Object.keys(AUTOMATION_TOOL_DEFAULT_CAPABILITIES).filter(
          k => ctx.capabilities?.[k as keyof typeof ctx.capabilities] === true
        ),
        features: Object.keys(ctx.featureFlags || {}).filter(
          k => ctx.featureFlags?.[k] === true
        ),
        registeredTools: tools.map(t => t.id),
        toolCount: tools.length
      };
      const data = {
        item,
        summary: `tools_runtime_${AUTOMATION_TOOL_RUNTIME_VERSION}`,
        found: true
      };
      return annotateReadMetrics(
        makeToolResult({
          status: "success",
          data,
          displayData: data,
          logs: ["system.info:ok"]
        }),
        { resultCount: 1 }
      );
    }
  }
);

export const ContactSearchTool = defineTool(
  readToolBase({
    id: "contact.search",
    name: "contact.search",
    description: "Busca contatos read-only da empresa.",
    category: "contact",
    capabilities: ["tool.read", "contact.read"],
    requiredPermissions: ["aiTools.executeRead"],
    inputSchema: {
      type: "object",
      additionalProperties: false,
      fields: [
        { name: "name", type: "string", maxLength: 100 },
        { name: "phone", type: "string", maxLength: 30 },
        { name: "email", type: "string", maxLength: 120 },
        { name: "tag", type: "string", maxLength: 80 },
        ...paginationFields
      ]
    },
    outputSchema: listOutput
  }),
  {
    execute: async (ctx, input) => {
      const cache = getToolCacheStore();
      const key = buildToolCacheKey([
        "contact.search",
        ctx.companyId,
        input.name,
        input.phone,
        input.email,
        input.tag,
        input.limit,
        input.offset
      ]);
      const cached = await cache.get<{
        items: Array<Record<string, unknown>>;
        count: number;
        hasMore: boolean;
      }>(key);
      if (cached) {
        return annotateReadMetrics(
          successList(
            cached.items,
            cached.count,
            cached.hasMore,
            `contacts:${cached.items.length}`,
            true
          ),
          { resultCount: cached.items.length, cacheHit: true }
        );
      }

      const result = await queryContactsForTool({
        companyId: ctx.companyId,
        name: input.name ? String(input.name) : undefined,
        phone: input.phone ? String(input.phone) : undefined,
        email: input.email ? String(input.email) : undefined,
        tagName: input.tag ? String(input.tag) : undefined,
        limit: input.limit,
        offset: input.offset
      });
      await cache.set(key, result, 30);
      return annotateReadMetrics(
        successList(
          result.items as unknown as Array<Record<string, unknown>>,
          result.count,
          result.hasMore,
          `contacts:${result.items.length}`
        ),
        { resultCount: result.items.length }
      );
    },
    sanitizeInputForAudit: input => ({
      name: input.name,
      phone: input.phone ? "***" : undefined,
      email: input.email ? "***@" : undefined,
      tag: input.tag,
      limit: input.limit,
      offset: input.offset
    })
  }
);

export const ContactReadTool = defineTool(
  readToolBase({
    id: "contact.read",
    name: "contact.read",
    description: "Lê snapshot mínimo de um contato.",
    category: "contact",
    capabilities: ["tool.read", "contact.read"],
    requiredPermissions: ["aiTools.executeRead"],
    inputSchema: {
      type: "object",
      additionalProperties: false,
      fields: [
        { name: "contactId", type: "number", required: true, minimum: 1 }
      ]
    },
    outputSchema: itemOutput
  }),
  {
    execute: async (ctx, input) => {
      const contactId = Number(input.contactId);
      const item = await queryContactByIdForTool({
        companyId: ctx.companyId,
        contactId
      });
      const data = {
        item: item || null,
        found: Boolean(item),
        summary: item ? `contact:${item.name}` : "not_found"
      };
      if (!item) {
        return annotateReadMetrics(
          makeToolResult({
            status: "success",
            data,
            displayData: data,
            warnings: ["contact_not_found"],
            logs: ["contact.read:empty"]
          }),
          { resultCount: 0 }
        );
      }
      return annotateReadMetrics(
        makeToolResult({
          status: "success",
          data,
          displayData: data,
          logs: ["contact.read:ok"]
        }),
        { resultCount: 1 }
      );
    }
  }
);

export const TicketSearchTool = defineTool(
  readToolBase({
    id: "ticket.search",
    name: "ticket.search",
    description: "Busca tickets read-only da empresa.",
    category: "ticket",
    capabilities: ["tool.read", "ticket.read"],
    requiredPermissions: ["aiTools.executeRead"],
    inputSchema: {
      type: "object",
      additionalProperties: false,
      fields: [
        { name: "status", type: "string", maxLength: 32 },
        { name: "queueId", type: "number", minimum: 1 },
        { name: "userId", type: "number", minimum: 1 },
        { name: "contactId", type: "number", minimum: 1 },
        ...paginationFields
      ]
    },
    outputSchema: listOutput
  }),
  {
    execute: async (ctx, input) => {
      const result = await queryTicketsForTool({
        companyId: ctx.companyId,
        status: input.status ? String(input.status) : undefined,
        queueId: input.queueId != null ? Number(input.queueId) : undefined,
        userId: input.userId != null ? Number(input.userId) : undefined,
        contactId: input.contactId != null ? Number(input.contactId) : undefined,
        limit: input.limit,
        offset: input.offset
      });
      return annotateReadMetrics(
        successList(
          result.items as unknown as Array<Record<string, unknown>>,
          result.count,
          result.hasMore,
          `tickets:${result.items.length}`
        ),
        { resultCount: result.items.length }
      );
    }
  }
);

export const TicketReadTool = defineTool(
  readToolBase({
    id: "ticket.read",
    name: "ticket.read",
    description: "Resumo read-only de um ticket.",
    category: "ticket",
    capabilities: ["tool.read", "ticket.read"],
    requiredPermissions: ["aiTools.executeRead"],
    inputSchema: {
      type: "object",
      additionalProperties: false,
      fields: [
        { name: "ticketId", type: "number", required: true, minimum: 1 }
      ]
    },
    outputSchema: itemOutput
  }),
  {
    execute: async (ctx, input) => {
      const item = await queryTicketByIdForTool({
        companyId: ctx.companyId,
        ticketId: Number(input.ticketId)
      });
      const data = {
        item: item || null,
        found: Boolean(item),
        summary: item ? `ticket:${item.status}` : "not_found"
      };
      return annotateReadMetrics(
        makeToolResult({
          status: "success",
          data,
          displayData: data,
          warnings: item ? [] : ["ticket_not_found"],
          logs: [item ? "ticket.read:ok" : "ticket.read:empty"]
        }),
        { resultCount: item ? 1 : 0 }
      );
    }
  }
);

export const QueueListTool = defineTool(
  readToolBase({
    id: "queue.list",
    name: "queue.list",
    description: "Lista filas da empresa.",
    category: "queue",
    capabilities: ["tool.read", "queue.read"],
    requiredPermissions: ["aiTools.executeRead"],
    inputSchema: {
      type: "object",
      additionalProperties: false,
      fields: [...paginationFields]
    },
    outputSchema: listOutput
  }),
  {
    execute: async (ctx, input) => {
      const result = await queryQueuesForTool({
        companyId: ctx.companyId,
        limit: input.limit,
        offset: input.offset
      });
      return annotateReadMetrics(
        successList(
          result.items as unknown as Array<Record<string, unknown>>,
          result.count,
          result.hasMore,
          `queues:${result.items.length}`
        ),
        { resultCount: result.items.length }
      );
    }
  }
);

export const UserListTool = defineTool(
  readToolBase({
    id: "user.list",
    name: "user.list",
    description: "Lista usuários autorizados da empresa.",
    category: "user",
    capabilities: ["tool.read", "user.read"],
    requiredPermissions: ["aiTools.executeRead"],
    inputSchema: {
      type: "object",
      additionalProperties: false,
      fields: [
        { name: "search", type: "string", maxLength: 80 },
        ...paginationFields
      ]
    },
    outputSchema: listOutput
  }),
  {
    execute: async (ctx, input) => {
      const result = await queryUsersForTool({
        companyId: ctx.companyId,
        search: input.search ? String(input.search) : undefined,
        limit: input.limit,
        offset: input.offset
      });
      return annotateReadMetrics(
        successList(
          result.items as unknown as Array<Record<string, unknown>>,
          result.count,
          result.hasMore,
          `users:${result.items.length}`
        ),
        { resultCount: result.items.length }
      );
    }
  }
);

export const KnowledgeSearchTool = defineTool(
  readToolBase({
    id: "knowledge.search",
    name: "knowledge.search",
    description: "Busca conhecimento (trechos sanitizados, sem embeddings).",
    category: "knowledge",
    capabilities: ["tool.read"],
    requiredPermissions: ["aiTools.executeRead"],
    requiredFeatures: [KNOWLEDGE_FEATURE],
    inputSchema: {
      type: "object",
      additionalProperties: false,
      fields: [
        {
          name: "query",
          type: "string",
          required: true,
          maxLength: 500,
          description: "Consulta de busca"
        },
        { name: "knowledgeBaseId", type: "number", minimum: 1 },
        ...paginationFields
      ]
    },
    outputSchema: listOutput,
    tags: ["knowledge"]
  }),
  {
    execute: async (ctx, input) => {
      const { limit } = resolveToolPagination({
        limit: input.limit,
        offset: 0,
        maxLimit: 20,
        defaultLimit: 5
      });
      try {
        const kbId =
          input.knowledgeBaseId != null
            ? Number(input.knowledgeBaseId)
            : undefined;
        const result = await SearchKnowledgeChunksService({
          companyId: ctx.companyId,
          query: String(input.query || "").slice(0, 500),
          knowledgeBaseIds: kbId ? [kbId] : undefined,
          limit
        });
        const items = (result.results || []).map(r => ({
          documentTitle: r.documentTitle,
          knowledgeBaseName: r.knowledgeBaseName,
          sectionTitle: r.sectionTitle,
          excerpt: String(r.chunkContent || "").slice(0, 400),
          score:
            typeof r.similarityScore === "number"
              ? Math.round(r.similarityScore * 1000) / 1000
              : null,
          documentType: r.documentType,
          language: r.language
        }));
        return annotateReadMetrics(
          successList(
            items,
            items.length,
            false,
            `knowledge_hits:${items.length}`
          ),
          { resultCount: items.length }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return makeToolResult({
          status: "failure",
          data: {},
          displayData: {},
          errors: [
            {
              code: "DEPENDENCY",
              type: "dependency",
              message: message.slice(0, 300),
              retryable: true
            }
          ],
          logs: ["knowledge.search:failed"]
        });
      }
    },
    sanitizeInputForAudit: input => ({
      query:
        typeof input.query === "string"
          ? input.query.slice(0, 80)
          : undefined,
      knowledgeBaseId: input.knowledgeBaseId,
      limit: input.limit
    }),
    sanitizeOutputForAudit: output => ({
      count: Array.isArray(output.items) ? output.items.length : 0,
      summary: output.summary
    })
  }
);

export const AutomationExecutionReadTool = defineTool(
  readToolBase({
    id: "automation.execution.read",
    name: "automation.execution.read",
    description: "Resumo de execução do Orchestrator (sem replay completo).",
    category: "system",
    capabilities: ["tool.read", "tool.internal"],
    requiredPermissions: ["aiTools.executeRead"],
    inputSchema: {
      type: "object",
      additionalProperties: false,
      fields: [
        {
          name: "executionId",
          type: "number",
          required: true,
          minimum: 1
        }
      ]
    },
    outputSchema: itemOutput,
    tags: ["automation"]
  }),
  {
    execute: async (ctx, input) => {
      try {
        const execution = await GetAutomationExecutionService({
          companyId: ctx.companyId,
          executionId: Number(input.executionId)
        });
        const steps = (
          (execution as unknown as { steps?: Array<Record<string, unknown>> })
            .steps || []
        ).slice(0, 30);
        const timeline = steps.map(s => ({
          stepIndex: s.stepIndex,
          action: s.actionName,
          status: s.status,
          result: s.resultStatus,
          durationMs: s.durationMs
        }));
        const item = {
          status: execution.status,
          intent: execution.intent,
          controlMode: execution.controlMode,
          ownership: execution.ownership,
          currentStep: execution.currentStep,
          fallbackToLegacy: execution.fallbackToLegacy,
          circuitBreakerTripped: execution.circuitBreakerTripped,
          startedAt: execution.startedAt
            ? new Date(execution.startedAt).toISOString()
            : null,
          finishedAt: execution.finishedAt
            ? new Date(execution.finishedAt).toISOString()
            : null,
          timeline,
          actionCount: timeline.length
        };
        const data = {
          item,
          found: true,
          summary: `execution:${execution.status}`
        };
        return annotateReadMetrics(
          makeToolResult({
            status: "success",
            data,
            displayData: data,
            logs: ["automation.execution.read:ok"]
          }),
          { resultCount: 1 }
        );
      } catch (err) {
        const data = {
          item: null,
          found: false,
          summary: "not_found"
        };
        return annotateReadMetrics(
          makeToolResult({
            status: "success",
            data,
            displayData: data,
            warnings: ["execution_not_found"],
            logs: ["automation.execution.read:empty"]
          }),
          { resultCount: 0 }
        );
      }
    }
  }
);

export const READ_TOOLS = [
  SystemInfoTool,
  ContactSearchTool,
  ContactReadTool,
  TicketSearchTool,
  TicketReadTool,
  QueueListTool,
  UserListTool,
  KnowledgeSearchTool,
  AutomationExecutionReadTool
];
