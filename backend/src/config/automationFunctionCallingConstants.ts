/**
 * Fase IA 2.1D/E — Function Calling (Simulator + Shadow observacional).
 */

export const AUTOMATION_FUNCTION_CALLING_VERSION = "2.1.0-d";

/** Máximo de tool calls por turno do modelo (sequencial). */
export const FC_MAX_TOOL_CALLS_PER_TURN = 3;

/** Máximo de iterações LLM → tools → LLM. */
export const FC_MAX_LOOPS = 3;

/** Prefixos/IDs elegíveis para exposição ao modelo nesta fase. */
export const FC_ELIGIBLE_TOOL_ID_PATTERNS = [
  /^system\./,
  /^contact\./,
  /^ticket\./,
  /^queue\./,
  /^user\./,
  /^knowledge\./,
  /^automation\.execution\.read$/
] as const;

export const FC_PLANNER_CATEGORIES = [
  "system",
  "contact",
  "ticket",
  "queue",
  "user",
  "knowledge",
  "automation"
] as const;

export type FcPlannerCategory = (typeof FC_PLANNER_CATEGORIES)[number];

export const FC_EVENTS = [
  "FunctionCallingStarted",
  "ToolsSelected",
  "ProviderToolsBuilt",
  "ToolCallRequested",
  "ToolCallResolved",
  "ToolCallDenied",
  "ToolCallInvalid",
  "FunctionCallingLoopStopped",
  "FunctionCallingCompleted"
] as const;

export type FcEventName = (typeof FC_EVENTS)[number];

export function isFcEligibleToolId(toolId: string): boolean {
  const id = String(toolId || "");
  return FC_ELIGIBLE_TOOL_ID_PATTERNS.some(re => re.test(id));
}

export function categoryFromToolId(toolId: string): FcPlannerCategory | null {
  const id = String(toolId || "");
  if (id.startsWith("system.")) return "system";
  if (id.startsWith("contact.")) return "contact";
  if (id.startsWith("ticket.")) return "ticket";
  if (id.startsWith("queue.")) return "queue";
  if (id.startsWith("user.")) return "user";
  if (id.startsWith("knowledge.")) return "knowledge";
  if (id.startsWith("automation.")) return "automation";
  return null;
}

export function providerFunctionNameToToolId(name: string): string {
  return String(name || "").trim().replace(/_/g, ".");
}

export function toolIdToProviderFunctionName(toolId: string): string {
  return String(toolId || "").replace(/\./g, "_");
}
