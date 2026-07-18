import AppError from "../../../errors/AppError";
import {
  AI_AGENT_KNOWLEDGE_DEFAULTS
} from "../../../config/aiAgentKnowledgeConstants";
import {
  getOrCreateAiAgentKnowledgeSettings,
  serializeAiAgentKnowledgeSettings
} from "./ShowAiAgentKnowledgeSettingsService";

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function clampFloat(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export default async function UpsertAiAgentKnowledgeSettingsService(input: {
  companyId: number;
  aiAgentId: number;
  userId: number | null;
  body: Record<string, unknown>;
}) {
  const row = await getOrCreateAiAgentKnowledgeSettings({
    companyId: input.companyId,
    aiAgentId: input.aiAgentId,
    userId: input.userId
  });

  const body = input.body || {};
  const patch: Record<string, unknown> = {
    updatedBy: input.userId
  };

  if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled);
  if (body.enabledInSimulator !== undefined) {
    patch.enabledInSimulator = Boolean(body.enabledInSimulator);
  }
  if (body.enabledInShadow !== undefined) {
    patch.enabledInShadow = Boolean(body.enabledInShadow);
  }
  if (body.enabledInLive !== undefined) {
    patch.enabledInLive = Boolean(body.enabledInLive);
  }

  // Live exige enabled geral
  if (patch.enabledInLive === true && patch.enabled === false) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Ative a Base de Conhecimento (enabled) antes de habilitar no Live."
    );
  }
  if (
    patch.enabledInLive === true &&
    body.enabled === undefined &&
    !row.enabled
  ) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Ative a Base de Conhecimento (enabled) antes de habilitar no Live."
    );
  }

  if (body.topK !== undefined) {
    patch.topK = clampInt(body.topK, 1, 20, AI_AGENT_KNOWLEDGE_DEFAULTS.topK);
  }
  if (body.minimumScore !== undefined) {
    patch.minimumScore = clampFloat(
      body.minimumScore,
      0,
      1,
      AI_AGENT_KNOWLEDGE_DEFAULTS.minimumScore
    );
  }
  if (body.maxContextCharacters !== undefined) {
    patch.maxContextCharacters = clampInt(
      body.maxContextCharacters,
      500,
      20000,
      AI_AGENT_KNOWLEDGE_DEFAULTS.maxContextCharacters
    );
  }
  if (body.maxContextTokens !== undefined) {
    patch.maxContextTokens = clampInt(
      body.maxContextTokens,
      100,
      8000,
      AI_AGENT_KNOWLEDGE_DEFAULTS.maxContextTokens
    );
  }
  if (body.maxChunksPerDocument !== undefined) {
    patch.maxChunksPerDocument = clampInt(
      body.maxChunksPerDocument,
      1,
      10,
      AI_AGENT_KNOWLEDGE_DEFAULTS.maxChunksPerDocument
    );
  }
  if (body.maxChunksPerBase !== undefined) {
    patch.maxChunksPerBase = clampInt(
      body.maxChunksPerBase,
      1,
      20,
      AI_AGENT_KNOWLEDGE_DEFAULTS.maxChunksPerBase
    );
  }
  if (body.includeSourcesInInternalMetadata !== undefined) {
    patch.includeSourcesInInternalMetadata = Boolean(
      body.includeSourcesInInternalMetadata
    );
  }
  if (body.allowAnswerWithoutKnowledge !== undefined) {
    patch.allowAnswerWithoutKnowledge = Boolean(
      body.allowAnswerWithoutKnowledge
    );
  }
  if (body.handoffWhenKnowledgeMissing !== undefined) {
    patch.handoffWhenKnowledgeMissing = Boolean(
      body.handoffWhenKnowledgeMissing
    );
  }
  if (body.documentTypes !== undefined) {
    patch.documentTypes = Array.isArray(body.documentTypes)
      ? body.documentTypes.map(String).slice(0, 20)
      : null;
  }
  if (body.languages !== undefined) {
    patch.languages = Array.isArray(body.languages)
      ? body.languages.map(String).slice(0, 20)
      : null;
  }
  if (body.retrievalMode !== undefined) {
    const mode = String(body.retrievalMode || "semantic");
    patch.retrievalMode = mode === "semantic" ? "semantic" : "semantic";
  }

  const nextTopK = Number(
    patch.topK !== undefined ? patch.topK : row.topK
  );
  const nextPerDoc = Number(
    patch.maxChunksPerDocument !== undefined
      ? patch.maxChunksPerDocument
      : row.maxChunksPerDocument
  );
  const nextPerBase = Number(
    patch.maxChunksPerBase !== undefined
      ? patch.maxChunksPerBase
      : row.maxChunksPerBase
  );
  if (nextPerDoc > nextTopK || nextPerBase > nextTopK) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "maxChunksPerDocument e maxChunksPerBase não podem exceder topK."
    );
  }

  const nextAllow =
    patch.allowAnswerWithoutKnowledge !== undefined
      ? Boolean(patch.allowAnswerWithoutKnowledge)
      : row.allowAnswerWithoutKnowledge;
  const nextHandoff =
    patch.handoffWhenKnowledgeMissing !== undefined
      ? Boolean(patch.handoffWhenKnowledgeMissing)
      : row.handoffWhenKnowledgeMissing;

  // Precedência documentada: handoff prevalece sobre allowAnswerWithoutKnowledge.
  // Aceitamos a combinação, mas registramos aviso no metadata.
  if (nextAllow && nextHandoff) {
    const prevMeta =
      row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    patch.metadata = {
      ...prevMeta,
      configNote:
        "handoffWhenKnowledgeMissing prevalece sobre allowAnswerWithoutKnowledge quando não há conhecimento."
    };
  }

  if (Array.isArray(patch.documentTypes)) {
    const allowed = new Set([
      "general",
      "faq",
      "product",
      "service",
      "price_table",
      "procedure",
      "policy",
      "contract",
      "catalog",
      "manual",
      "website",
      "other"
    ]);
    const invalid = (patch.documentTypes as string[]).filter(
      t => !allowed.has(t)
    );
    if (invalid.length) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        `documentTypes inválidos: ${invalid.join(", ")}`
      );
    }
  }

  if (Array.isArray(patch.languages)) {
    const invalidLang = (patch.languages as string[]).filter(
      l => !/^[a-z]{2}(-[A-Za-z]{2})?$/.test(String(l))
    );
    if (invalidLang.length) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "languages deve usar códigos como pt-BR ou en."
      );
    }
  }

  await row.update(patch);
  return serializeAiAgentKnowledgeSettings(await row.reload());
}
