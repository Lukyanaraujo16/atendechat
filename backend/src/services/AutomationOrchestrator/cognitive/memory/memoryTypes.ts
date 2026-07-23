import {
  MemoryEventName,
  MemorySource,
  MemoryType,
  AUTOMATION_COGNITIVE_MEMORY_VERSION
} from "../../../../config/automationCognitiveMemoryConstants";

export type KnowledgeEntity = {
  key: string;
  value: string;
};

export type KnowledgeObject = {
  id: string;
  memoryType: MemoryType;
  tenantId: number;
  agentId: number | null;
  ticketId: number | null;
  contactId: number | null;
  goalId: string | null;
  executionId: string | null;
  title: string;
  summary: string;
  content: string;
  entities: KnowledgeEntity[];
  tags: string[];
  confidence: number;
  importance: number;
  source: MemorySource | string;
  version: number;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type MemoryIndex = {
  entity: string | null;
  tenant: number;
  agent: number | null;
  contact: number | null;
  ticket: number | null;
  goal: string | null;
  tags: string[];
  importance: number;
  confidence: number;
  memoryId: string;
  memoryType: MemoryType;
};

export type MemoryQuery = {
  tenantId: number;
  agentId?: number | null;
  ticketId?: number | null;
  contactId?: number | null;
  goalId?: string | null;
  memoryType?: MemoryType | MemoryType[] | null;
  tags?: string[];
  text?: string;
  dateRange?: { from?: string; to?: string } | null;
  importanceMin?: number;
  confidenceMin?: number;
  executionId?: string | null;
  limit?: number;
};

export type ScoredMemory = {
  object: KnowledgeObject;
  score: number;
  scoreBreakdown: {
    recency: number;
    importance: number;
    confidence: number;
    frequency: number;
    type: number;
  };
};

export type MemoryEvent = {
  id: string;
  tenantId: number;
  memoryId?: string;
  name: MemoryEventName | string;
  at: string;
  message?: string;
  meta?: Record<string, unknown>;
};

export type MemoryReplaySlice = {
  feedbackId?: string;
  knowledgeObjects: KnowledgeObject[];
  savedIds: string[];
};

export { AUTOMATION_COGNITIVE_MEMORY_VERSION };
