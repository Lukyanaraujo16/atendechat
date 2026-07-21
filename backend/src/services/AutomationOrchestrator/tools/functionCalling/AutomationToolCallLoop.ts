import { ChatCompletionRequestMessage } from "openai";
import {
  FC_MAX_LOOPS,
  FC_MAX_TOOL_CALLS_PER_TURN,
  AUTOMATION_FUNCTION_CALLING_VERSION
} from "../../../../config/automationFunctionCallingConstants";
import { AiProviderId } from "../../../../config/aiProviderModels";
import { generateChatCompletionViaAdapter } from "../../../AiProviderService/AiProviderAdapterFactory";
import { selectToolsForFunctionCalling } from "./AutomationToolSelectionEngine";
import { buildProviderToolPayload } from "./AutomationProviderToolAdapter";
import {
  hashToolCall,
  resolveProviderToolCall,
  buildFunctionCallingToolContext,
  ProviderToolCall,
  ResolvedToolCall
} from "./AutomationFunctionCallResolver";
import {
  recordFunctionCallingMetric,
  recordFunctionCallingSelection
} from "./FunctionCallingMetrics";
import { emitToolEvent } from "../ToolEventBus";
import hasPlanFeature from "../../../../helpers/hasPlanFeature";
import { AUTOMATION_ORCHESTRATOR_FEATURE_KEY } from "../../../../config/automationOrchestratorConstants";
import { AUTOMATION_AI_TOOLS_FEATURE_KEY } from "../../../../config/automationToolConstants";

export type FunctionCallingLoopTrace = {
  version: string;
  provider: string;
  selectedTools: Array<{ id: string; version: string }>;
  allowlist: Array<{ id: string; version: string; key: string }>;
  providerPayload: Record<string, unknown>;
  iterations: Array<{
    index: number;
    providerLatencyMs: number;
    promptTokens?: number;
    completionTokens?: number;
    toolCalls: ProviderToolCall[];
    resolutions: ResolvedToolCall[];
    assistantText?: string;
  }>;
  loopStopReason?: string;
  finalText: string;
  totalProviderLatencyMs: number;
  totalToolLatencyMs: number;
  totalLoops: number;
};

/**
 * Ciclo LLM → Tool Call → Runtime → Result → LLM (máx. FC_MAX_LOOPS).
 * Origins: simulator | admin_test | shadow | live.
 */
export async function runFunctionCallingLoop(input: {
  companyId: number;
  userId?: number | null;
  aiAgentId?: number | null;
  provider: AiProviderId;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  messages: ChatCompletionRequestMessage[];
  timeoutMs: number;
  source: string;
  plannerCategories?: Array<
    "system" | "contact" | "ticket" | "queue" | "user" | "knowledge" | "automation"
  >;
  origin?: "simulator" | "admin_test" | "shadow" | "live";
  ticketId?: number | null;
  contactId?: number | null;
  /** Live only — default false. Nunca liga Write Tools automaticamente. */
  allowWriteTools?: boolean;
}): Promise<FunctionCallingLoopTrace> {
  const origin = input.origin || "simulator";
  const [hasAgent, hasTools, hasKnowledge] = await Promise.all([
    hasPlanFeature(input.companyId, AUTOMATION_ORCHESTRATOR_FEATURE_KEY),
    hasPlanFeature(input.companyId, AUTOMATION_AI_TOOLS_FEATURE_KEY),
    hasPlanFeature(input.companyId, "automation.knowledge_base")
  ]);

  const ctxSeed = buildFunctionCallingToolContext({
    companyId: input.companyId,
    userId: input.userId,
    aiAgentId: input.aiAgentId,
    ticketId: input.ticketId,
    contactId: input.contactId,
    allowedToolKeys: [],
    source:
      origin === "admin_test"
        ? "admin_test"
        : origin === "live"
          ? "live"
          : origin,
    channel: origin === "shadow" ? "shadow" : origin,
    featureFlags: {
      [AUTOMATION_ORCHESTRATOR_FEATURE_KEY]: hasAgent,
      [AUTOMATION_AI_TOOLS_FEATURE_KEY]: hasTools,
      "automation.knowledge_base": hasKnowledge
    },
    requestId: `fc-${origin}-${Date.now()}`
  });

  const allowWrite = origin === "live" && input.allowWriteTools === true;

  const selection = selectToolsForFunctionCalling({
    ctx: ctxSeed,
    provider: input.provider,
    plannerCategories: input.plannerCategories,
    origin,
    companyPolicy: {
      enabled: hasAgent && hasTools,
      maxRiskLevel: allowWrite ? "medium" : "read_only",
      allowWrite
    }
  });

  const ctx = {
    ...ctxSeed,
    allowedToolKeys: selection.allowedToolKeys
  };

  const adapterOut = buildProviderToolPayload({
    manifests: selection.tools,
    provider: input.provider
  });

  recordFunctionCallingSelection({
    companyId: input.companyId,
    selectedIds: selection.tools.map(t => t.id),
    availableCount: selection.tools.length
  });

  await emitToolEvent({
    companyId: input.companyId,
    eventName: "ToolsSelected",
    payload: {
      count: selection.tools.length,
      ids: selection.tools.map(t => t.id),
      origin
    }
  });

  const trace: FunctionCallingLoopTrace = {
    version: AUTOMATION_FUNCTION_CALLING_VERSION,
    provider: input.provider,
    selectedTools: selection.tools.map(t => ({
      id: t.id,
      version: t.version
    })),
    allowlist: selection.allowlist,
    providerPayload: adapterOut.providerPayload as unknown as Record<
      string,
      unknown
    >,
    iterations: [],
    finalText: "",
    totalProviderLatencyMs: 0,
    totalToolLatencyMs: 0,
    totalLoops: 0
  };

  if (!selection.tools.length) {
    // Sem tools: uma chamada normal sem FC
    const result = await generateChatCompletionViaAdapter({
      provider: input.provider,
      companyId: input.companyId,
      apiKey: input.apiKey,
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      systemPrompt: input.systemPrompt,
      messages: input.messages,
      timeoutMs: input.timeoutMs,
      source: input.source
    });
    if (result.ok) {
      trace.finalText = result.text;
      trace.totalProviderLatencyMs = result.latencyMs;
    } else {
      const errCode =
        "errorCode" in result ? String(result.errorCode) : "unknown";
      trace.loopStopReason = `provider_error:${errCode}`;
    }
    return trace;
  }

  const workingMessages: ChatCompletionRequestMessage[] = [
    ...input.messages
  ];
  const seenCallHashes = new Set<string>();
  const callChain: string[] = [];

  for (let loop = 0; loop < FC_MAX_LOOPS; loop += 1) {
    recordFunctionCallingMetric({
      companyId: input.companyId,
      kind: "iteration"
    });
    trace.totalLoops += 1;

    const providerResult = await generateChatCompletionViaAdapter({
      provider: input.provider,
      companyId: input.companyId,
      apiKey: input.apiKey,
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      systemPrompt: input.systemPrompt,
      messages: workingMessages,
      timeoutMs: input.timeoutMs,
      source: input.source,
      tools: adapterOut.providerPayload.openaiTools,
      geminiFunctionDeclarations:
        adapterOut.providerPayload.geminiFunctionDeclarations
    });

    if (!providerResult.ok) {
      const errCode =
        "errorCode" in providerResult
          ? String(providerResult.errorCode)
          : "unknown";
      trace.loopStopReason = `provider_error:${errCode}`;
      recordFunctionCallingMetric({
        companyId: input.companyId,
        kind: "loopStop"
      });
      break;
    }

    recordFunctionCallingMetric({
      companyId: input.companyId,
      kind: "providerLatency",
      durationMs: providerResult.latencyMs
    });
    trace.totalProviderLatencyMs += providerResult.latencyMs;

    const toolCalls = (providerResult.toolCalls || []).slice(
      0,
      FC_MAX_TOOL_CALLS_PER_TURN
    );

    const iteration: FunctionCallingLoopTrace["iterations"][0] = {
      index: loop,
      providerLatencyMs: providerResult.latencyMs,
      promptTokens: providerResult.promptTokens,
      completionTokens: providerResult.completionTokens,
      toolCalls,
      resolutions: [],
      assistantText: providerResult.text
    };

    if (!toolCalls.length) {
      trace.finalText = providerResult.text;
      trace.iterations.push(iteration);
      break;
    }

    // Proteção: recursão A→B→A e repetição idêntica
    for (const call of toolCalls) {
      const args =
        typeof call.arguments === "string"
          ? (() => {
              try {
                return JSON.parse(call.arguments || "{}");
              } catch {
                return {};
              }
            })()
          : call.arguments || {};
      const toolId = String(call.name || "").replace(/_/g, ".");
      const h = hashToolCall(toolId, args as Record<string, unknown>);
      if (seenCallHashes.has(h)) {
        trace.loopStopReason = "repeated_tool_call";
        recordFunctionCallingMetric({
          companyId: input.companyId,
          kind: "loopStop"
        });
        await emitToolEvent({
          companyId: input.companyId,
          eventName: "FunctionCallingLoopStopped",
          payload: { reason: "repeated_tool_call", toolId }
        });
        trace.iterations.push(iteration);
        return finalizeTrace(trace, providerResult.text);
      }
      seenCallHashes.add(h);

      if (
        callChain.length >= 2 &&
        callChain[callChain.length - 2] === toolId &&
        callChain.includes(toolId)
      ) {
        // A → B → A
        const prev = callChain[callChain.length - 1];
        if (prev !== toolId && callChain[callChain.length - 2] === toolId) {
          // already covered
        }
      }
      if (callChain.includes(toolId) && callChain[callChain.length - 1] !== toolId) {
        // tool reappears after another tool — recursion pattern
        if (callChain.filter(x => x === toolId).length >= 1 && callChain.length >= 2) {
          const lastTwo = callChain.slice(-2);
          if (lastTwo[0] === toolId || callChain[0] === toolId) {
            trace.loopStopReason = "call_recursion";
            recordFunctionCallingMetric({
              companyId: input.companyId,
              kind: "loopStop"
            });
            await emitToolEvent({
              companyId: input.companyId,
              eventName: "FunctionCallingLoopStopped",
              payload: { reason: "call_recursion", chain: callChain }
            });
            trace.iterations.push(iteration);
            return finalizeTrace(trace, providerResult.text);
          }
        }
      }
      callChain.push(toolId);
    }

    // Append assistant tool_calls message (OpenAI style)
    workingMessages.push({
      role: "assistant",
      content: providerResult.text || null,
      tool_calls: toolCalls.map(c => ({
        id: c.id,
        type: "function",
        function: {
          name: c.name,
          arguments:
            typeof c.arguments === "string"
              ? c.arguments
              : JSON.stringify(c.arguments || {})
        }
      }))
    } as ChatCompletionRequestMessage);

    for (const call of toolCalls) {
      const resolved = await resolveProviderToolCall({
        call,
        ctx,
        allowlist: selection.allowlist
      });
      iteration.resolutions.push(resolved);
      trace.totalToolLatencyMs += resolved.durationMs;

      workingMessages.push({
        role: "tool",
        content: JSON.stringify(resolved.modelResult),
        tool_call_id: call.id,
        name: call.name
      } as unknown as ChatCompletionRequestMessage);
    }

    trace.iterations.push(iteration);

    if (loop === FC_MAX_LOOPS - 1) {
      // última iteração: se ainda há tool calls, parar e usar texto parcial
      const last = await generateChatCompletionViaAdapter({
        provider: input.provider,
        companyId: input.companyId,
        apiKey: input.apiKey,
        model: input.model,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        systemPrompt: input.systemPrompt,
        messages: workingMessages,
        timeoutMs: input.timeoutMs,
        source: input.source
        // sem tools — forçar resposta final
      });
      if (last.ok) {
        trace.finalText = last.text;
        trace.totalProviderLatencyMs += last.latencyMs;
      } else {
        trace.finalText = providerResult.text || "";
        trace.loopStopReason = "max_loops_reached";
      }
      recordFunctionCallingMetric({
        companyId: input.companyId,
        kind: "loopStop"
      });
      break;
    }
  }

  if (!trace.finalText && !trace.loopStopReason) {
    const lastIter = trace.iterations[trace.iterations.length - 1];
    trace.finalText = lastIter?.assistantText || "";
  }

  await emitToolEvent({
    companyId: input.companyId,
    eventName: "FunctionCallingCompleted",
    payload: {
      loops: trace.totalLoops,
      toolCalls: trace.iterations.reduce(
        (n, i) => n + i.resolutions.length,
        0
      ),
      stop: trace.loopStopReason || "completed"
    }
  });

  return trace;
}

function finalizeTrace(
  trace: FunctionCallingLoopTrace,
  fallbackText: string
): FunctionCallingLoopTrace {
  if (!trace.finalText) trace.finalText = fallbackText || "";
  return trace;
}

export default { runFunctionCallingLoop };
