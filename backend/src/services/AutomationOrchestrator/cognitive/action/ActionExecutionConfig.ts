import {
  ActionExecutionConfig,
  ActionType,
  DEFAULT_ACTION_EXECUTION_CONFIG,
  StrategyConfig
} from "../../../../config/automationActionExecutionConstants";

const byCompany = new Map<number, ActionExecutionConfig>();

function cloneDefault(): ActionExecutionConfig {
  return JSON.parse(JSON.stringify(DEFAULT_ACTION_EXECUTION_CONFIG));
}

export function getActionExecutionConfig(
  companyId?: number
): ActionExecutionConfig {
  if (companyId != null && byCompany.has(companyId)) {
    return byCompany.get(companyId)!;
  }
  return cloneDefault();
}

export function getStrategyConfig(
  companyId: number | undefined,
  actionType: ActionType
): StrategyConfig {
  return getActionExecutionConfig(companyId).strategies[actionType];
}

export function setActionExecutionConfig(
  companyId: number,
  partial: Partial<ActionExecutionConfig> | Record<string, unknown>
): ActionExecutionConfig {
  const current = getActionExecutionConfig(companyId);
  const p = partial as Partial<ActionExecutionConfig>;
  const merged: ActionExecutionConfig = {
    ...current,
    ...p,
    strategies: {
      ...current.strategies,
      ...(p.strategies || {})
    },
    usesToolRuntime: false
  };
  byCompany.set(companyId, merged);
  return merged;
}

export function __resetActionExecutionConfigForTests(): void {
  byCompany.clear();
}

export default { getActionExecutionConfig, setActionExecutionConfig };
