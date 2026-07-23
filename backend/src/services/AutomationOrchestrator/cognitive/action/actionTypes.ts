import {
  ActionEngineEventName,
  ActionExecutionStatus,
  ActionType,
  ActionValidationResult,
  AUTOMATION_ACTION_EXECUTION_VERSION
} from "../../../../config/automationActionExecutionConstants";

export type ExecutionActionEntity = {
  key: string;
  value: string;
};

export type ExecutionAction = {
  id: string;
  stepId: string;
  actionType: ActionType;
  objective: string;
  entities: ExecutionActionEntity[];
  constraints: string[];
  expectedOutcome: string;
  requiresConfirmation: boolean;
  retryable: boolean;
  metadata: Record<string, unknown>;
};

export type ActionExecutionResult = {
  actionId: string;
  stepId: string;
  actionType: ActionType;
  strategy: string;
  status: ActionExecutionStatus;
  startedAt: string;
  finishedAt: string;
  duration: number;
  output: Record<string, unknown>;
  validation: ActionValidationResult;
  metrics: {
    retries: number;
    simulatedLatencyMs: number;
  };
  errors: string[];
  warnings: string[];
  metadata: Record<string, unknown>;
};

export type ActionEngineEvent = {
  id: string;
  actionId: string;
  name: ActionEngineEventName | string;
  at: string;
  message?: string;
  meta?: Record<string, unknown>;
};

export type ActionExecutionReplaySlice = {
  action: ExecutionAction;
  result: ActionExecutionResult;
  events: ActionEngineEvent[];
};

export { AUTOMATION_ACTION_EXECUTION_VERSION };
