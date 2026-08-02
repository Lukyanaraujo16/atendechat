import AppError from "../../errors/AppError";
import AiAgent from "../../models/AiAgent";
import AiAgentSimulationSession from "../../models/AiAgentSimulationSession";
import { Op } from "sequelize";
import { generateChatCompletionViaAdapter } from "../AiProviderService/AiProviderAdapterFactory";
import { buildAiAgentSystemPrompt } from "./buildAiAgentSystemPrompt";
import { loadAiAgentProfileForRuntime } from "./resolveAiAgentBusinessPrompt";
import { resolveAiAgentApiCredentialForSimulation } from "./resolveAiAgentApiCredential";
import {
  parseAiAgentMaxTokens,
  parseAiAgentModelForProvider
} from "./aiAgentValidation";
import { parseAiAgentHandoffSignal } from "./parseAiAgentHandoffSignal";
import { formatAiAgentSignedMessage } from "./formatAiAgentSignedMessage";
import {
  buildAiAgentHandoffTransitionMessage,
  sanitizeAiAgentClientFacingText
} from "./buildAiAgentHandoffTransitionMessage";
import { buildSimulationContextMessages } from "./buildSimulationContextMessages";
import { findSimulationSessionOrThrow } from "./aiAgentSimulationSerialization";
import AiAgentSimulationMessage from "../../models/AiAgentSimulationMessage";
import AiAgentSimulationMessageReview from "../../models/AiAgentSimulationMessageReview";
import {
  AI_AGENT_SIMULATOR_MAX_MESSAGE_CHARS,
  AI_AGENT_SIMULATOR_MAX_MESSAGES_PER_SESSION,
  AI_AGENT_SIMULATOR_MAX_OPEN_SESSIONS,
  AI_AGENT_SIMULATOR_MAX_TOKENS_CAP,
  AI_AGENT_SIMULATOR_MAX_USER_MESSAGES,
  AI_AGENT_SIMULATOR_SOURCE,
  AI_AGENT_SIMULATOR_TIMEOUT_MS
} from "./aiAgentSimulatorConfig";
import { AI_AGENT_SHADOW_ERROR_CODES } from "./aiAgentShadowErrors";
import { findAiAgentOrThrow } from "./aiAgentTenant";
import {
  applyKnowledgeToSystemPrompt,
  buildKnowledgeRuntimeMetadata,
  safeRetrieveKnowledgeForAgent
} from "./knowledge/integrateKnowledgeIntoRuntime";
import { safeEmitKnowledgeObservability } from "./analytics/emitKnowledgeObservability";
import { safeRecordAgentAnalyticsEvent } from "./analytics/recordAgentAnalyticsEvent";

const SIMULATOR_ERROR_CODES = {
  MISSING_CREDENTIAL: "missing_credential",
  SESSION_ENDED: "session_ended",
  SESSION_MESSAGE_LIMIT: "session_message_limit",
  SESSION_USER_MESSAGE_LIMIT: "session_user_message_limit",
  MESSAGE_TOO_LONG: "message_too_long",
  OPEN_SESSION_LIMIT: "open_session_limit"
} as const;

function parseUserMessage(value: unknown): string {
  const content = String(value ?? "").trim();
  if (!content) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Mensagem é obrigatória.");
  }
  if (content.length > AI_AGENT_SIMULATOR_MAX_MESSAGE_CHARS) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `Mensagem deve ter no máximo ${AI_AGENT_SIMULATOR_MAX_MESSAGE_CHARS} caracteres.`,
      { errorCode: SIMULATOR_ERROR_CODES.MESSAGE_TOO_LONG }
    );
  }
  return content;
}

async function assertResolvableCredential(companyId: number, agent: AiAgent) {
  const resolved = await resolveAiAgentApiCredentialForSimulation({
    companyId,
    agent
  });
  if (!resolved.apiKey || !resolved.provider) {
    throw new AppError(
      "ERR_AI_AGENT_SIMULATOR_MISSING_CREDENTIAL",
      400,
      "Configure uma credencial OpenAI ou Google Gemini antes de simular.",
      { errorCode: SIMULATOR_ERROR_CODES.MISSING_CREDENTIAL }
    );
  }
  return resolved;
}

export async function createAiAgentSimulationSession(input: {
  companyId: number;
  aiAgentId: number;
  createdBy: number;
}) {
  const agent = await findAiAgentOrThrow(input.companyId, input.aiAgentId);
  const resolved = await assertResolvableCredential(input.companyId, agent);

  const openCount = await AiAgentSimulationSession.count({
    where: {
      companyId: input.companyId,
      aiAgentId: input.aiAgentId,
      createdBy: input.createdBy,
      status: "active"
    }
  });

  if (openCount >= AI_AGENT_SIMULATOR_MAX_OPEN_SESSIONS) {
    throw new AppError(
      "ERR_AI_AGENT_SIMULATOR_OPEN_SESSION_LIMIT",
      400,
      "Encerre uma sessão ativa antes de iniciar outra simulação.",
      { errorCode: SIMULATOR_ERROR_CODES.OPEN_SESSION_LIMIT }
    );
  }

  let model: string;
  try {
    model = parseAiAgentModelForProvider(agent.model, resolved.provider);
  } catch {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Modelo incompatível com o provedor da credencial."
    );
  }

  const now = new Date();
  const session = await AiAgentSimulationSession.create({
    companyId: input.companyId,
    aiAgentId: input.aiAgentId,
    createdBy: input.createdBy,
    status: "active",
    provider: resolved.provider,
    model,
    messageCount: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalLatencyMs: 0,
    startedAt: now
  });

  return {
    id: session.id,
    aiAgentId: session.aiAgentId,
    status: session.status,
    provider: session.provider,
    model: session.model,
    messageCount: session.messageCount,
    totalTokens: session.totalTokens,
    startedAt: session.startedAt,
    messages: []
  };
}

export async function listAiAgentSimulationSessions(input: {
  companyId: number;
  aiAgentId: number;
  pageNumber?: string;
}) {
  await findAiAgentOrThrow(input.companyId, input.aiAgentId);

  const page = Math.max(1, Number(input.pageNumber) || 1);
  const limit = 10;
  const offset = (page - 1) * limit;

  const { rows, count } = await AiAgentSimulationSession.findAndCountAll({
    where: {
      companyId: input.companyId,
      aiAgentId: input.aiAgentId
    },
    order: [["createdAt", "DESC"]],
    limit,
    offset
  });

  return {
    sessions: rows.map((session) => ({
      id: session.id,
      status: session.status,
      provider: session.provider,
      model: session.model,
      messageCount: session.messageCount,
      totalTokens: session.totalTokens,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      createdAt: session.createdAt
    })),
    count,
    hasMore: count > offset + rows.length
  };
}

export async function showAiAgentSimulationSession(input: {
  companyId: number;
  aiAgentId: number;
  sessionId: number;
}) {
  const session = await findSimulationSessionOrThrow(input);
  const messages = await AiAgentSimulationMessage.findAll({
    where: { companyId: input.companyId, sessionId: session.id },
    order: [["createdAt", "ASC"]],
    include: [
      {
        model: AiAgentSimulationMessageReview,
        as: "review",
        required: false
      }
    ]
  });

  const { serializeSimulationSession } = await import("./aiAgentSimulationSerialization");
  return serializeSimulationSession(session, messages);
}

export async function endAiAgentSimulationSession(input: {
  companyId: number;
  aiAgentId: number;
  sessionId: number;
}) {
  const session = await findSimulationSessionOrThrow(input);
  if (session.status === "ended") {
    return { id: session.id, status: session.status, endedAt: session.endedAt };
  }

  const endedAt = new Date();
  await session.update({ status: "ended", endedAt });
  return { id: session.id, status: "ended", endedAt };
}

export async function sendAiAgentSimulationMessage(input: {
  companyId: number;
  aiAgentId: number;
  sessionId: number;
  content: unknown;
  /** 2.1D — Function Calling somente no Simulador. */
  functionCalling?: boolean;
  plannerCategories?: Array<
    "system" | "contact" | "ticket" | "queue" | "user" | "knowledge" | "automation"
  >;
  userId?: number | null;
}) {
  const session = await findSimulationSessionOrThrow(input);
  if (session.status !== "active") {
    throw new AppError(
      "ERR_AI_AGENT_SIMULATOR_SESSION_ENDED",
      400,
      "Esta sessão de simulação já foi encerrada.",
      { errorCode: SIMULATOR_ERROR_CODES.SESSION_ENDED }
    );
  }

  const content = parseUserMessage(input.content);
  const agent = await findAiAgentOrThrow(input.companyId, input.aiAgentId);

  if (session.messageCount >= AI_AGENT_SIMULATOR_MAX_MESSAGES_PER_SESSION) {
    throw new AppError(
      "ERR_AI_AGENT_SIMULATOR_MESSAGE_LIMIT",
      400,
      "Limite de mensagens da sessão atingido. Reinicie a conversa.",
      { errorCode: SIMULATOR_ERROR_CODES.SESSION_MESSAGE_LIMIT }
    );
  }

  const userMessageCount = await AiAgentSimulationMessage.count({
    where: {
      companyId: input.companyId,
      sessionId: session.id,
      role: "user"
    }
  });

  if (userMessageCount >= AI_AGENT_SIMULATOR_MAX_USER_MESSAGES) {
    throw new AppError(
      "ERR_AI_AGENT_SIMULATOR_USER_MESSAGE_LIMIT",
      400,
      "Limite de mensagens do usuário atingido. Reinicie a conversa.",
      { errorCode: SIMULATOR_ERROR_CODES.SESSION_USER_MESSAGE_LIMIT }
    );
  }

  const resolved = await assertResolvableCredential(input.companyId, agent);
  const userRow = await AiAgentSimulationMessage.create({
    companyId: input.companyId,
    sessionId: session.id,
    role: "user",
    content,
    handoffSuggested: false
  });

  const historyRows = await AiAgentSimulationMessage.findAll({
    where: {
      companyId: input.companyId,
      sessionId: session.id,
      role: { [Op.in]: ["user", "assistant"] }
    },
    order: [["createdAt", "ASC"]],
    attributes: ["role", "content"]
  });

  const profile = await loadAiAgentProfileForRuntime({
    companyId: input.companyId,
    aiAgentId: agent.id
  });
  let systemPrompt = buildAiAgentSystemPrompt(agent, profile);
  const messages = buildSimulationContextMessages(historyRows);

  const retrieval = await safeRetrieveKnowledgeForAgent({
    companyId: input.companyId,
    aiAgentId: agent.id,
    query: content,
    channel: "simulator",
    conversationContext: historyRows.map(r => ({
      role: r.role,
      content: r.content
    })),
    simulationSessionId: session.id,
    requestId: `sim-${session.id}-${userRow.id}`
  });
  const knowledgeApplied = applyKnowledgeToSystemPrompt(
    systemPrompt,
    retrieval
  );
  systemPrompt = knowledgeApplied.systemPrompt;
  const knowledgeMeta = buildKnowledgeRuntimeMetadata(retrieval);

  let model: string;
  let maxTokens: number;
  try {
    model = parseAiAgentModelForProvider(agent.model, resolved.provider!);
    maxTokens = Math.min(
      parseAiAgentMaxTokens(agent.maxTokens),
      AI_AGENT_SIMULATOR_MAX_TOKENS_CAP
    );
  } catch {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Modelo incompatível com o provedor da credencial."
    );
  }

  const startedAt = Date.now();
  const functionCalling = input.functionCalling === true;

  let result: Awaited<ReturnType<typeof generateChatCompletionViaAdapter>>;
  let functionCallingTrace: Record<string, unknown> | null = null;

  if (functionCalling) {
    const { runFunctionCallingLoop } = await import(
      "../AutomationOrchestrator/tools/functionCalling/AutomationToolCallLoop"
    );
    const trace = await runFunctionCallingLoop({
      companyId: input.companyId,
      userId: input.userId ?? null,
      aiAgentId: agent.id,
      provider: resolved.provider!,
      apiKey: resolved.apiKey!,
      model,
      maxTokens,
      temperature: agent.temperature,
      systemPrompt,
      messages,
      timeoutMs: AI_AGENT_SIMULATOR_TIMEOUT_MS,
      source: AI_AGENT_SIMULATOR_SOURCE,
      origin: "simulator",
      plannerCategories: input.plannerCategories
    });
    functionCallingTrace = {
      version: trace.version,
      provider: trace.provider,
      selectedTools: trace.selectedTools,
      allowlist: trace.allowlist,
      providerPayload: trace.providerPayload,
      iterations: trace.iterations.map(it => ({
        index: it.index,
        providerLatencyMs: it.providerLatencyMs,
        toolCalls: it.toolCalls,
        resolutions: it.resolutions.map(r => ({
          callId: r.callId,
          toolId: r.toolId,
          status: r.status,
          arguments: r.arguments,
          modelResult: r.modelResult,
          durationMs: r.durationMs,
          error: r.error
        })),
        assistantText: it.assistantText
      })),
      loopStopReason: trace.loopStopReason || null,
      totalLoops: trace.totalLoops,
      totalProviderLatencyMs: trace.totalProviderLatencyMs,
      totalToolLatencyMs: trace.totalToolLatencyMs
    };

    if (trace.loopStopReason?.startsWith("provider_error:")) {
      result = {
        ok: false,
        errorCode: "GENERATION_FAILED" as any,
        latencyMs: trace.totalProviderLatencyMs || Date.now() - startedAt
      };
    } else {
      result = {
        ok: true,
        text: trace.finalText || "",
        provider: resolved.provider!,
        model,
        latencyMs: Date.now() - startedAt,
        promptTokens: trace.iterations.reduce(
          (n, i) => n + (i.promptTokens || 0),
          0
        ),
        completionTokens: trace.iterations.reduce(
          (n, i) => n + (i.completionTokens || 0),
          0
        ),
        totalTokens: undefined
      };
    }
  } else {
    result = await generateChatCompletionViaAdapter({
      provider: resolved.provider!,
      companyId: input.companyId,
      ticketId: null,
      apiKey: resolved.apiKey!,
      model,
      maxTokens,
      temperature: agent.temperature,
      systemPrompt,
      messages,
      timeoutMs: AI_AGENT_SIMULATOR_TIMEOUT_MS,
      source: AI_AGENT_SIMULATOR_SOURCE
    });
  }

  const latencyMs = result.latencyMs ?? Date.now() - startedAt;

  if (result.ok === false) {
    const failMeta = {
      ...(knowledgeMeta || {}),
      ...(functionCallingTrace
        ? { functionCalling: functionCallingTrace }
        : {})
    };
    const assistantRow = await AiAgentSimulationMessage.create({
      companyId: input.companyId,
      sessionId: session.id,
      role: "assistant",
      content: "",
      provider: resolved.provider,
      model,
      latencyMs,
      errorCode: result.errorCode,
      handoffSuggested: false,
      metadata: failMeta
    });

    await session.update({
      messageCount: session.messageCount + 2,
      totalLatencyMs: session.totalLatencyMs + latencyMs
    });

    return {
      userMessage: {
        id: userRow.id,
        role: userRow.role,
        content: userRow.content,
        createdAt: userRow.createdAt,
        knowledge: knowledgeMeta?.knowledge || null
      },
      assistantMessage: {
        id: assistantRow.id,
        role: assistantRow.role,
        content: assistantRow.content,
        errorCode: assistantRow.errorCode,
        provider: assistantRow.provider,
        model: assistantRow.model,
        latencyMs: assistantRow.latencyMs,
        handoffSuggested: false,
        handoffReason: null,
        createdAt: assistantRow.createdAt,
        knowledge: knowledgeMeta?.knowledge || null,
        functionCalling: functionCallingTrace
      },
      knowledge: knowledgeMeta?.knowledge || null,
      functionCalling: functionCallingTrace,
      session: {
        id: session.id,
        messageCount: session.messageCount,
        totalTokens: session.totalTokens,
        totalLatencyMs: session.totalLatencyMs
      }
    };
  }

  const handoff = parseAiAgentHandoffSignal(result.text);
  const handoffSuggested =
    handoff.handoffRequested || knowledgeApplied.forceHandoff;
  const signedAssistant = formatAiAgentSignedMessage({
    agentName: agent.name,
    content: sanitizeAiAgentClientFacingText(
      handoff.cleanText ||
        (handoffSuggested
          ? buildAiAgentHandoffTransitionMessage({
              reason: handoff.handoffReason || "knowledge_missing",
              configuredHandoffMessage: agent.handoffMessage,
              tone: profile?.tone || "professional"
            })
          : "")
    )
  });
  const successMeta = {
    ...(knowledgeMeta || {}),
    ...(functionCallingTrace
      ? { functionCalling: functionCallingTrace }
      : {}),
    messageSigned: signedAssistant.signed,
    handoffSuggested
  };
  const assistantRow = await AiAgentSimulationMessage.create({
    companyId: input.companyId,
    sessionId: session.id,
    role: "assistant",
    content: signedAssistant.body || handoff.cleanText,
    provider: result.provider || resolved.provider,
    model: result.model || model,
    promptTokens: result.promptTokens ?? null,
    completionTokens: result.completionTokens ?? null,
    totalTokens: result.totalTokens ?? null,
    latencyMs,
    handoffSuggested,
    handoffReason: handoff.handoffReason || (knowledgeApplied.forceHandoff
      ? "knowledge_missing"
      : null),
    metadata: successMeta
  });

  await userRow.update({ metadata: knowledgeMeta });

  await session.update({
    messageCount: session.messageCount + 2,
    totalPromptTokens: session.totalPromptTokens + (result.promptTokens || 0),
    totalCompletionTokens:
      session.totalCompletionTokens + (result.completionTokens || 0),
    totalTokens: session.totalTokens + (result.totalTokens || 0),
    totalLatencyMs: session.totalLatencyMs + latencyMs,
    provider: result.provider || session.provider,
    model: result.model || session.model
  });

  void safeEmitKnowledgeObservability({
    companyId: input.companyId,
    aiAgentId: agent.id,
    channel: "simulator",
    query: content,
    retrieval,
    decision: knowledgeApplied.decision,
    simulationId: session.id,
    requestId: `sim-${session.id}-${userRow.id}`,
    provider: result.provider || resolved.provider,
    model: result.model || model,
    latencyMs,
    responseText: handoff.cleanText,
    systemPrompt,
    tokensInput: result.promptTokens,
    tokensOutput: result.completionTokens,
    interaction: true
  });
  void safeRecordAgentAnalyticsEvent({
    companyId: input.companyId,
    aiAgentId: agent.id,
    channel: "simulator",
    kind: "generation",
    handoff: handoffSuggested,
    tokensInput: result.promptTokens,
    tokensOutput: result.completionTokens,
    provider: result.provider || resolved.provider,
    model: result.model || model,
    generationTimeMs: latencyMs
  });

  return {
    userMessage: {
      id: userRow.id,
      role: userRow.role,
      content: userRow.content,
      createdAt: userRow.createdAt,
      knowledge: knowledgeMeta?.knowledge || null
    },
    assistantMessage: {
      id: assistantRow.id,
      role: assistantRow.role,
      content: assistantRow.content,
      provider: assistantRow.provider,
      model: assistantRow.model,
      promptTokens: assistantRow.promptTokens,
      completionTokens: assistantRow.completionTokens,
      totalTokens: assistantRow.totalTokens,
      latencyMs: assistantRow.latencyMs,
      handoffSuggested: assistantRow.handoffSuggested,
      handoffReason: assistantRow.handoffReason,
      createdAt: assistantRow.createdAt,
      knowledge: knowledgeMeta?.knowledge || null,
      functionCalling: functionCallingTrace
    },
    knowledge: knowledgeMeta?.knowledge || null,
    functionCalling: functionCallingTrace,
    session: {
      id: session.id,
      messageCount: session.messageCount,
      totalTokens: session.totalTokens,
      totalLatencyMs: session.totalLatencyMs
    }
  };
}

export async function checkAiAgentSimulatorCredential(input: {
  companyId: number;
  aiAgentId: number;
}) {
  const agent = await findAiAgentOrThrow(input.companyId, input.aiAgentId);
  const resolved = await resolveAiAgentApiCredentialForSimulation({
    companyId: input.companyId,
    agent
  });

  return {
    canSimulate: Boolean(resolved.apiKey && resolved.provider),
    credentialSource: resolved.source,
    provider: resolved.provider,
    model: resolved.provider
      ? (() => {
          try {
            return parseAiAgentModelForProvider(agent.model, resolved.provider!);
          } catch {
            return null;
          }
        })()
      : null
  };
}

export { SIMULATOR_ERROR_CODES, AI_AGENT_SHADOW_ERROR_CODES };
