import { createHash } from "crypto";
import { CognitiveMemoryEngine } from "./CognitiveMemoryEngine";
import {
  buildKnowledgeFromFeedback,
  buildMemoryIndex
} from "./KnowledgeBuilder";
import {
  getCognitiveMemoryConfig,
  setCognitiveMemoryConfig
} from "./CognitiveMemoryConfig";
import {
  getCognitiveMemoryMetrics,
  listMemoryEvents
} from "./CognitiveMemoryMetrics";
import { defaultSqlMemoryProvider } from "./providers/SqlMemoryProvider";
import {
  KnowledgeObject,
  MemoryQuery,
  MemoryReplaySlice
} from "./memoryTypes";
import { ExecutionFeedback } from "../feedback/feedbackTypes";
import * as FeedbackAdmin from "../feedback/ExecutionFeedbackAdminServices";

const engineSingleton = new CognitiveMemoryEngine();
const replaysByCompany = new Map<
  number,
  Array<{ id: string; slices: MemoryReplaySlice[]; createdAt: string }>
>();

function pushCap<T>(arr: T[], item: T, max = 100): void {
  arr.push(item);
  if (arr.length > max) arr.shift();
}

export async function CreateMemoryService(input: {
  companyId: number;
  object?: Partial<KnowledgeObject>;
  feedback?: ExecutionFeedback;
  agentId?: number | null;
  ticketId?: number | null;
  contactId?: number | null;
  goalId?: string | null;
  executionId?: string | null;
}): Promise<{ objects: KnowledgeObject[]; indexes: ReturnType<typeof buildMemoryIndex>[] }> {
  if (input.feedback) {
    const built = buildKnowledgeFromFeedback({
      tenantId: input.companyId,
      feedback: input.feedback,
      agentId: input.agentId,
      ticketId: input.ticketId,
      contactId: input.contactId,
      goalId: input.goalId,
      executionId: input.executionId
    });
    const { objects } = await engineSingleton.saveMany(built);
    return {
      objects,
      indexes: objects.map(buildMemoryIndex)
    };
  }

  if (!input.object) {
    throw new Error("object ou feedback obrigatório");
  }

  const now = new Date().toISOString();
  const object: KnowledgeObject = {
    id:
      input.object.id ||
      `ko_${createHash("sha256").update(`${input.companyId}:${Date.now()}`).digest("hex").slice(0, 14)}`,
    memoryType: (input.object.memoryType as any) || "EPISODIC",
    tenantId: input.companyId,
    agentId: input.object.agentId ?? input.agentId ?? null,
    ticketId: input.object.ticketId ?? input.ticketId ?? null,
    contactId: input.object.contactId ?? input.contactId ?? null,
    goalId: input.object.goalId ?? input.goalId ?? null,
    executionId: input.object.executionId ?? input.executionId ?? null,
    title: input.object.title || "Untitled",
    summary: input.object.summary || "",
    content: input.object.content || "",
    entities: input.object.entities || [],
    tags: input.object.tags || [],
    confidence: input.object.confidence ?? 0.5,
    importance: input.object.importance ?? 0.5,
    source: input.object.source || "manual",
    version: 1,
    createdAt: now,
    updatedAt: now,
    metadata: {
      ...(input.object.metadata || {}),
      usesEmbeddings: false,
      vectorIndexed: false
    }
  };

  const { object: saved } = await engineSingleton.save(object);
  return { objects: [saved], indexes: [buildMemoryIndex(saved)] };
}

export async function ListMemoryService(input: {
  companyId: number;
  limit?: number;
}) {
  const objects = await engineSingleton.list(input.companyId, input.limit || 50);
  const byType = await engineSingleton.countByType(input.companyId);
  return { objects, byType, metrics: getCognitiveMemoryMetrics() };
}

export async function GetMemoryService(input: {
  companyId: number;
  id: string;
}) {
  const object = await engineSingleton.get(input.companyId, input.id);
  return { object };
}

export async function QueryMemoryService(input: {
  companyId: number;
  query: Omit<MemoryQuery, "tenantId"> & { tenantId?: number };
}) {
  // force tenant isolation — ignore client-supplied foreign tenant
  const { results, event } = await engineSingleton.query({
    ...input.query,
    tenantId: input.companyId
  });
  return { results, event };
}

export async function GetCognitiveMemoryDashboardService(input: {
  companyId: number;
}) {
  const byType = await engineSingleton.countByType(input.companyId);
  const metrics = getCognitiveMemoryMetrics();
  return {
    working: byType.WORKING || 0,
    episodic: byType.EPISODIC || 0,
    semantic: byType.SEMANTIC || 0,
    procedural: byType.PROCEDURAL || 0,
    reflection: byType.REFLECTION || 0,
    knowledgeGrowth: metrics.knowledgeGrowth,
    metrics,
    vectorEnabled: false,
    usesEmbeddings: false,
    storageProvider: getCognitiveMemoryConfig(input.companyId).storageProvider
  };
}

export async function GetCognitiveMemoryConfigService(input: {
  companyId: number;
}) {
  return { config: getCognitiveMemoryConfig(input.companyId) };
}

export async function UpsertCognitiveMemoryConfigService(input: {
  companyId: number;
  config: Record<string, unknown>;
}) {
  return {
    config: setCognitiveMemoryConfig(input.companyId, input.config)
  };
}

export async function GetCognitiveMemoryMetricsService() {
  return {
    metrics: getCognitiveMemoryMetrics(),
    events: listMemoryEvents(20),
    vectorEnabled: false,
    usesEmbeddings: false
  };
}

export async function BuildKnowledgeTesterService(input: {
  companyId: number;
  feedback?: ExecutionFeedback;
  runtimeStatus?: string;
}) {
  let feedback = input.feedback;
  if (!feedback) {
    const sim = await FeedbackAdmin.SimulateFeedbackService({
      companyId: input.companyId,
      runtimeStatus: input.runtimeStatus || "success",
      objective: "memory knowledge builder"
    });
    feedback = sim.record.feedback;
  }
  const objects = buildKnowledgeFromFeedback({
    tenantId: input.companyId,
    feedback
  });
  return {
    feedback,
    objects,
    indexes: objects.map(buildMemoryIndex),
    usesEmbeddings: false
  };
}

export async function ReplayCognitiveMemoryService(input: {
  companyId: number;
  userId?: number | null;
  text?: string;
  sessionId?: string;
}): Promise<{
  replay: {
    feedback: Awaited<
      ReturnType<typeof FeedbackAdmin.ReplayExecutionFeedbackService>
    >["replay"];
    memorySlices: MemoryReplaySlice[];
  };
}> {
  const { replay } = await FeedbackAdmin.ReplayExecutionFeedbackService({
    companyId: input.companyId,
    userId: input.userId,
    text: input.text,
    sessionId: input.sessionId
  });

  const memorySlices: MemoryReplaySlice[] = [];
  for (const slice of replay.feedbackSlices || []) {
    const objects = buildKnowledgeFromFeedback({
      tenantId: input.companyId,
      feedback: slice.feedback,
      executionId: slice.feedback.sessionId
    });
    const { objects: saved } = await engineSingleton.saveMany(objects);
    memorySlices.push({
      feedbackId: slice.feedback.feedbackId,
      knowledgeObjects: objects,
      savedIds: saved.map(s => s.id)
    });
  }

  const replays = replaysByCompany.get(input.companyId) || [];
  pushCap(replays, {
    id: `memreplay_${createHash("sha256")
      .update(`${Date.now()}`)
      .digest("hex")
      .slice(0, 12)}`,
    slices: memorySlices,
    createdAt: new Date().toISOString()
  });
  replaysByCompany.set(input.companyId, replays);

  return {
    replay: {
      feedback: replay,
      memorySlices
    }
  };
}

export function __resetCognitiveMemoryAdminForTests(): void {
  replaysByCompany.clear();
  defaultSqlMemoryProvider.__reset();
}

export default {
  CreateMemoryService,
  GetCognitiveMemoryDashboardService
};
