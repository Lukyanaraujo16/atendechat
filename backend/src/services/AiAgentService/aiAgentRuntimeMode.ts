import Whatsapp from "../../models/Whatsapp";

export type AiAgentRuntimeMode = "disabled" | "dry_run" | "shadow";

const VALID_MODES = new Set<AiAgentRuntimeMode>([
  "disabled",
  "dry_run",
  "shadow"
]);

export function parseAiAgentRuntimeMode(value: unknown): AiAgentRuntimeMode {
  const raw = String(value ?? "").trim().toLowerCase();
  if (VALID_MODES.has(raw as AiAgentRuntimeMode)) {
    return raw as AiAgentRuntimeMode;
  }
  return "disabled";
}

/** Modo efetivo da conexão (compatível com aiAgentEnabled legado). */
export function resolveWhatsappAiAgentRuntimeMode(
  whatsapp: Pick<Whatsapp, "aiAgentMode" | "aiAgentEnabled" | "aiAgentId">
): AiAgentRuntimeMode {
  const explicit = whatsapp.aiAgentMode;
  if (explicit && VALID_MODES.has(explicit as AiAgentRuntimeMode)) {
    return explicit as AiAgentRuntimeMode;
  }
  if (whatsapp.aiAgentEnabled === true && whatsapp.aiAgentId != null) {
    return "dry_run";
  }
  return "disabled";
}

export function isAiAgentRuntimeActive(mode: AiAgentRuntimeMode): boolean {
  return mode === "dry_run" || mode === "shadow";
}
