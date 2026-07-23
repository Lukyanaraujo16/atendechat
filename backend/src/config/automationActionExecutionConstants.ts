/**
 * AI Agent V2.3 — Action Execution Engine.
 * Executor genérico com Strategies simuladas. Sem Tool Runtime / Providers.
 */

export const AUTOMATION_ACTION_EXECUTION_VERSION = "2.3.0";

export const ACTION_TYPES = [
  "SEARCH",
  "VALIDATE",
  "TRANSFER",
  "UPDATE",
  "SEND_MESSAGE",
  "WAIT_CONFIRMATION",
  "WAIT_INPUT",
  "CUSTOM"
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_EXECUTION_STATUSES = [
  "PENDING",
  "RUNNING",
  "SUCCESS",
  "FAILED",
  "WAITING",
  "SKIPPED",
  "ABORTED"
] as const;

export type ActionExecutionStatus = (typeof ACTION_EXECUTION_STATUSES)[number];

export const ACTION_VALIDATION_RESULTS = [
  "VALID",
  "PARTIAL",
  "FAILED",
  "WAITING"
] as const;

export type ActionValidationResult = (typeof ACTION_VALIDATION_RESULTS)[number];

export const ACTION_ENGINE_EVENTS = [
  "ACTION_PREPARED",
  "ACTION_STARTED",
  "ACTION_COMPLETED",
  "ACTION_FAILED",
  "ACTION_WAITING",
  "ACTION_ABORTED"
] as const;

export type ActionEngineEventName = (typeof ACTION_ENGINE_EVENTS)[number];

export const STRATEGY_NAMES = [
  "SearchStrategy",
  "ValidateStrategy",
  "TransferStrategy",
  "UpdateStrategy",
  "MessagingStrategy",
  "ConfirmationStrategy",
  "InputStrategy",
  "CustomStrategy"
] as const;

export type StrategyName = (typeof STRATEGY_NAMES)[number];

export const DEFAULT_ACTION_EXECUTION_CONFIG = {
  strategies: {
    SEARCH: { timeoutMs: 5000, maxRetries: 1, validationEnabled: true },
    VALIDATE: { timeoutMs: 3000, maxRetries: 0, validationEnabled: true },
    TRANSFER: { timeoutMs: 8000, maxRetries: 1, validationEnabled: true },
    UPDATE: { timeoutMs: 6000, maxRetries: 1, validationEnabled: true },
    SEND_MESSAGE: { timeoutMs: 5000, maxRetries: 1, validationEnabled: true },
    WAIT_CONFIRMATION: {
      timeoutMs: 120_000,
      maxRetries: 0,
      validationEnabled: true
    },
    WAIT_INPUT: { timeoutMs: 120_000, maxRetries: 0, validationEnabled: true },
    CUSTOM: { timeoutMs: 5000, maxRetries: 1, validationEnabled: true }
  },
  simulateLatencyMs: 15,
  usesToolRuntime: false
} as const;

export type StrategyConfig = {
  timeoutMs: number;
  maxRetries: number;
  validationEnabled: boolean;
};

export type ActionExecutionConfig = {
  strategies: Record<ActionType, StrategyConfig>;
  simulateLatencyMs: number;
  usesToolRuntime: false;
};

export const ACTION_EXECUTION_SETTING_KEY = "automationActionExecution";
