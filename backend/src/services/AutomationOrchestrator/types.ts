import {
  AutomationActionResultStatus,
  AutomationControlMode,
  AutomationIntent
} from "../../config/automationOrchestratorConstants";

export type ConversationHistoryItem = {
  role: string;
  content: string;
};

export type ExecutionContext = {
  companyId: number;
  ticketId?: number | null;
  contactId?: number | null;
  whatsappId?: number | null;
  channel: string;
  messageId?: string | null;
  ticket: {
    id: number;
    status: string;
    userId: number | null;
    chatbot: boolean;
    queueId: number | null;
    aiAgentId?: number | null;
    aiAgentPaused?: boolean | null;
    aiAgentHandoffRequested?: boolean | null;
    isGroup: boolean;
  };
  contact: {
    id: number;
    name?: string | null;
  };
  currentMessage: {
    body: string;
    fromMe: boolean;
    hasText: boolean;
  };
  conversationHistory?: ConversationHistoryItem[];
  aiAgent: {
    id: number;
    name?: string | null;
    enabled?: boolean | null;
  } | null;
  knowledge: Record<string, unknown>;
  variables: Record<string, unknown>;
  flowState: { active: boolean; reason?: string };
  chatbotState: { active: boolean };
  integrationState: { active: boolean };
  controlMode: AutomationControlMode;
  metadata: Record<string, unknown>;
};

export type PlanStep = {
  index: number;
  actionName: string;
  params?: Record<string, unknown>;
};

export type AutomationPlan = {
  version: string;
  intent: AutomationIntent;
  reason: string;
  steps: PlanStep[];
};

export type ActionNextHint =
  | "continue"
  | "finish"
  | "handoff"
  | "wait"
  | "retry"
  | "fallback";

export type ActionResult = {
  status: AutomationActionResultStatus;
  message?: string;
  data?: Record<string, unknown>;
  nextHint?: ActionNextHint;
};

export type GraphNode = {
  id: string;
  label: string;
  stepIndex: number;
  status?: string;
  resultStatus?: string | null;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
};
