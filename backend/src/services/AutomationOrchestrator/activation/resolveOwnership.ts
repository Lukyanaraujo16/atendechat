import {
  AutomationControlMode,
  AutomationOwnership
} from "../../../config/automationOrchestratorConstants";

export type ResolveOwnershipInput = {
  controlMode: AutomationControlMode;
  circuitOpen: boolean;
  settingsEnabled: boolean;
};

export type ResolveOwnershipResult = {
  ownership: AutomationOwnership;
  reason: string;
};

/**
 * Ownership padrão = legacy.
 * Orquestrador só assume inbound em active/active_partial com circuit fechado e settings enabled.
 */
export function resolveOwnership(
  input: ResolveOwnershipInput
): ResolveOwnershipResult {
  const { controlMode, circuitOpen, settingsEnabled } = input;

  if (
    controlMode === "disabled" ||
    controlMode === "observe" ||
    controlMode === "shadow_execute"
  ) {
    return {
      ownership: "legacy",
      reason: `control_mode_${controlMode}`
    };
  }

  if (!settingsEnabled) {
    return { ownership: "legacy", reason: "settings_disabled" };
  }

  if (circuitOpen) {
    return { ownership: "legacy", reason: "circuit_breaker_open" };
  }

  if (controlMode === "active_partial" || controlMode === "active") {
    return {
      ownership: "orchestrator",
      reason: `control_mode_${controlMode}`
    };
  }

  return { ownership: "legacy", reason: "default_legacy" };
}

export default resolveOwnership;
