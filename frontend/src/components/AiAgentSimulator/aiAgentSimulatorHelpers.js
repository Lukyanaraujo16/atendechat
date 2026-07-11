import { getSegmentTemplate, segmentI18nKey } from "../../config/aiAgentSegmentTemplates";

export const DEFAULT_SIMULATION_PROMPT_KEYS = [
  "greeting",
  "humanRequest",
  "pricingQuestion",
  "serviceArea",
  "quoteRequest",
];

export function getSimulationPrompts(segment) {
  const template = getSegmentTemplate(segment);
  const keys =
    template.simulationPromptKeys && template.simulationPromptKeys.length
      ? template.simulationPromptKeys
      : DEFAULT_SIMULATION_PROMPT_KEYS;

  return keys.map((key) => ({
    key,
    labelKey:
      template.simulationPromptKeys && template.simulationPromptKeys.length
        ? segmentI18nKey(segment, "simulation", key)
        : `aiAgent.simulator.scenarios.default.${key}`,
  }));
}

export function mapSimulatorError(err) {
  const code = err?.response?.data?.errorCode || err?.response?.data?.data?.errorCode;
  const clientMessage = err?.response?.data?.message || err?.response?.data?.clientMessage;

  if (code === "missing_credential") return "missingCredential";
  if (code === "session_message_limit" || code === "session_user_message_limit") {
    return "sessionLimit";
  }
  if (code === "message_too_long") return "messageTooLong";
  if (code === "session_ended") return "sessionEnded";
  if (clientMessage) return "custom";
  return "generic";
}
