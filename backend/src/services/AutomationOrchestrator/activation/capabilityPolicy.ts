import {
  AUTOMATION_ACTION_CAPABILITY_MAP,
  AUTOMATION_DEFAULT_CAPABILITIES,
  AutomationCapabilityKey,
  AutomationCapabilityMode,
  AutomationControlMode
} from "../../../config/automationOrchestratorConstants";
import AppError from "../../../errors/AppError";
import { AutomationAction } from "../ActionRegistry";

export type CapabilityMap = Record<
  AutomationCapabilityKey,
  AutomationCapabilityMode
>;

export function getDefaultCapabilities(): CapabilityMap {
  return { ...AUTOMATION_DEFAULT_CAPABILITIES };
}

export function mergeCapabilities(
  overrides?: Partial<Record<string, string>> | null
): CapabilityMap {
  const merged = getDefaultCapabilities();
  if (!overrides || typeof overrides !== "object") return merged;

  for (const key of Object.keys(merged) as AutomationCapabilityKey[]) {
    const value = overrides[key];
    if (
      value === "legacy" ||
      value === "observe" ||
      value === "shadow" ||
      value === "active"
    ) {
      merged[key] = value;
    }
  }
  return merged;
}

/**
 * Inconsistência crítica: send_message=active exige planner ativo
 * (ou shadow quando controlMode=shadow_execute).
 */
export function validateCapabilityConsistency(
  controlMode: AutomationControlMode,
  capabilities: CapabilityMap
): void {
  const send = capabilities.send_message;
  const planner = capabilities.planner;

  if (send === "active") {
    const plannerOk =
      planner === "active" ||
      (controlMode === "shadow_execute" && planner === "shadow");
    if (!plannerOk) {
      throw new AppError(
        "ERR_AUTOMATION_CAPABILITY_INCONSISTENT",
        400,
        "send_message=active exige planner=active (ou shadow em shadow_execute)."
      );
    }
  }

  if (controlMode === "disabled") return;

  if (
    controlMode === "active" ||
    controlMode === "active_partial"
  ) {
    // send_message permanece legacy por padrão — não forçar active.
    // Apenas bloqueia inconsistências já cobertas acima.
  }
}

export function resolveActionCapability(
  actionName: string,
  actionMeta?: Pick<AutomationAction, "capability"> | null
): AutomationCapabilityKey {
  if (actionMeta?.capability) {
    const cap = String(actionMeta.capability);
    if (
      (Object.keys(AUTOMATION_DEFAULT_CAPABILITIES) as string[]).includes(cap)
    ) {
      return cap as AutomationCapabilityKey;
    }
  }

  const direct = AUTOMATION_ACTION_CAPABILITY_MAP[actionName];
  if (direct) return direct;

  const withSuffix = actionName.endsWith("Action")
    ? actionName
    : `${actionName}Action`;
  const mapped = AUTOMATION_ACTION_CAPABILITY_MAP[withSuffix];
  if (mapped) return mapped;

  return "planner";
}

export type CanExecuteActionInput = {
  controlMode: AutomationControlMode;
  capabilities: CapabilityMap;
  actionName: string;
  actionMeta?: Pick<
    AutomationAction,
    | "sideEffects"
    | "supportsShadow"
    | "supportsObserve"
    | "supportsActive"
    | "capability"
  > | null;
};

export type CanExecuteActionResult = {
  allowed: boolean;
  reason: string;
  effectiveMode: "skip" | "observe" | "shadow" | "active";
};

/**
 * Decide se a action pode rodar no motor do orquestrador e em qual modo efetivo.
 * Side effects nunca em observe/shadow_execute.
 */
export function canExecuteAction(
  input: CanExecuteActionInput
): CanExecuteActionResult {
  const { controlMode, capabilities, actionName, actionMeta } = input;
  const capability = resolveActionCapability(actionName, actionMeta);
  const capMode = capabilities[capability] ?? "legacy";
  const sideEffects = actionMeta?.sideEffects === true;
  const supportsShadow = actionMeta?.supportsShadow !== false;
  const supportsObserve = actionMeta?.supportsObserve !== false;

  if (controlMode === "disabled") {
    return {
      allowed: false,
      reason: "control_mode_disabled",
      effectiveMode: "skip"
    };
  }

  if (controlMode === "observe") {
    if (!supportsObserve) {
      return {
        allowed: false,
        reason: "action_does_not_support_observe",
        effectiveMode: "skip"
      };
    }
    return {
      allowed: true,
      reason: "observe_no_side_effects",
      effectiveMode: "observe"
    };
  }

  if (controlMode === "shadow_execute") {
    if (sideEffects) {
      return {
        allowed: false,
        reason: "shadow_skips_side_effects",
        effectiveMode: "skip"
      };
    }
    if (!supportsShadow) {
      return {
        allowed: false,
        reason: "action_does_not_support_shadow",
        effectiveMode: "skip"
      };
    }
    return {
      allowed: true,
      reason: "shadow_execute",
      effectiveMode: "shadow"
    };
  }

  if (controlMode === "active_partial") {
    if (capMode !== "active") {
      return {
        allowed: false,
        reason: `capability_${capability}_not_active`,
        effectiveMode: "skip"
      };
    }
    if (sideEffects && capability === "send_message") {
      // send_message ainda não wired a WhatsApp — bloqueia side effects reais.
      return {
        allowed: false,
        reason: "send_message_side_effects_not_wired",
        effectiveMode: "skip"
      };
    }
    if (actionMeta?.supportsActive === false) {
      return {
        allowed: false,
        reason: "action_does_not_support_active",
        effectiveMode: "skip"
      };
    }
    return {
      allowed: true,
      reason: "active_partial_capability_active",
      effectiveMode: "active"
    };
  }

  // controlMode === "active"
  if (capMode === "legacy") {
    return {
      allowed: false,
      reason: `capability_${capability}_legacy`,
      effectiveMode: "skip"
    };
  }
  if (sideEffects && capability === "send_message") {
    return {
      allowed: false,
      reason: "send_message_side_effects_not_wired",
      effectiveMode: "skip"
    };
  }
  if (actionMeta?.supportsActive === false) {
    return {
      allowed: false,
      reason: "action_does_not_support_active",
      effectiveMode: "skip"
    };
  }
  return {
    allowed: true,
    reason: "active",
    effectiveMode: "active"
  };
}

export default {
  getDefaultCapabilities,
  mergeCapabilities,
  validateCapabilityConsistency,
  resolveActionCapability,
  canExecuteAction
};
