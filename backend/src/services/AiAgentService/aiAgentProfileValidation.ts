import AppError from "../../errors/AppError";
import {
  AI_AGENT_ALLOWED_ACTIONS,
  AI_AGENT_BUSINESS_SEGMENTS,
  AI_AGENT_CLIENT_ADDRESS_STYLES,
  AI_AGENT_DEPARTMENTS,
  AI_AGENT_EMOJI_LEVELS,
  AI_AGENT_FORBIDDEN_ACTIONS,
  AI_AGENT_HANDOFF_RULES,
  AI_AGENT_PROFILE_LIMITS,
  AI_AGENT_RESPONSE_LENGTHS,
  AI_AGENT_SETUP_MODES,
  AI_AGENT_TONES
} from "../../config/aiAgentProfileConfig";
import { normalizeOptionalString } from "./aiAgentTenant";
import { ensurePlatformHandoffInvariants } from "./aiAgentHandoffPolicy";

export type AiAgentProfileInput = {
  setupMode?: string;
  companyName?: unknown;
  businessSegment?: unknown;
  customBusinessSegment?: unknown;
  departments?: unknown;
  attendantName?: unknown;
  attendantRole?: unknown;
  tone?: unknown;
  customTone?: unknown;
  clientAddressStyle?: unknown;
  emojiLevel?: unknown;
  responseLength?: unknown;
  allowedActions?: unknown;
  forbiddenActions?: unknown;
  handoffRules?: unknown;
  companyDescription?: unknown;
  productsAndServices?: unknown;
  serviceArea?: unknown;
  businessHours?: unknown;
  pricingPolicy?: unknown;
  negotiationPolicy?: unknown;
  schedulingPolicy?: unknown;
  frequentlyAskedQuestions?: unknown;
  importantInformation?: unknown;
  customInstructions?: unknown;
  sourceWebsite?: unknown;
};

export type ValidatedAiAgentProfileInput = {
  setupMode: "guided" | "advanced" | "legacy";
  companyName: string;
  businessSegment: string;
  customBusinessSegment: string | null;
  departments: string[];
  attendantName: string;
  attendantRole: string | null;
  tone: string;
  customTone: string | null;
  clientAddressStyle: string | null;
  emojiLevel: string;
  responseLength: string;
  allowedActions: string[];
  forbiddenActions: string[];
  handoffRules: string[];
  companyDescription: string | null;
  productsAndServices: string | null;
  serviceArea: string | null;
  businessHours: string | null;
  pricingPolicy: string | null;
  negotiationPolicy: string | null;
  schedulingPolicy: string | null;
  frequentlyAskedQuestions: Array<{ question: string; answer: string }>;
  importantInformation: string | null;
  customInstructions: string | null;
  sourceWebsite: string | null;
};

function parseRequiredString(
  value: unknown,
  fieldLabel: string,
  maxLen: number
): string {
  const parsed = normalizeOptionalString(value, maxLen);
  if (!parsed) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `${fieldLabel} é obrigatório.`
    );
  }
  return parsed;
}

function parseEnumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fieldLabel: string
): T[number] {
  const raw = String(value ?? "").trim();
  if (!allowed.includes(raw as T[number])) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `${fieldLabel} inválido.`
    );
  }
  return raw as T[number];
}

function parseStringArray(
  value: unknown,
  allowed: readonly string[],
  fieldLabel: string,
  { required = false, minItems = 0 }: { required?: boolean; minItems?: number } = {}
): string[] {
  if (value == null || value === "") {
    if (required) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        `${fieldLabel} é obrigatório.`
      );
    }
    return [];
  }
  if (!Array.isArray(value)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `${fieldLabel} deve ser uma lista.`
    );
  }
  const unique = [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  if (unique.length < minItems) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `${fieldLabel} deve ter pelo menos ${minItems} item(ns).`
    );
  }
  for (const item of unique) {
    if (!allowed.includes(item)) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        `${fieldLabel} contém valor inválido.`
      );
    }
  }
  return unique;
}

function parseOptionalUrl(value: unknown): string | null {
  const raw = normalizeOptionalString(value, AI_AGENT_PROFILE_LIMITS.sourceWebsite);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("invalid protocol");
    }
    return raw;
  } catch {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Site de referência deve ser uma URL válida (http/https)."
    );
  }
}

function parseFaqItems(value: unknown): Array<{ question: string; answer: string }> {
  if (value == null || value === "") return [];
  if (!Array.isArray(value)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "FAQ deve ser uma lista."
    );
  }
  if (value.length > AI_AGENT_PROFILE_LIMITS.faqMaxItems) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `FAQ permite no máximo ${AI_AGENT_PROFILE_LIMITS.faqMaxItems} itens.`
    );
  }
  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        `FAQ item ${index + 1} inválido.`
      );
    }
    const question = parseRequiredString(
      (item as { question?: unknown }).question,
      `Pergunta da FAQ ${index + 1}`,
      AI_AGENT_PROFILE_LIMITS.faqQuestionMax
    );
    const answer = parseRequiredString(
      (item as { answer?: unknown }).answer,
      `Resposta da FAQ ${index + 1}`,
      AI_AGENT_PROFILE_LIMITS.faqAnswerMax
    );
    return { question, answer };
  });
}

export function validateAiAgentProfileInput(
  body: Record<string, unknown>
): ValidatedAiAgentProfileInput {
  const setupMode = parseEnumValue(
    body.setupMode ?? "guided",
    AI_AGENT_SETUP_MODES,
    "Modo de configuração"
  );

  const companyName = parseRequiredString(
    body.companyName,
    "Nome da empresa",
    AI_AGENT_PROFILE_LIMITS.companyName
  );
  const businessSegment = parseEnumValue(
    body.businessSegment,
    AI_AGENT_BUSINESS_SEGMENTS,
    "Segmento"
  );
  const customBusinessSegment =
    businessSegment === "other"
      ? parseRequiredString(
          body.customBusinessSegment,
          "Segmento personalizado",
          AI_AGENT_PROFILE_LIMITS.customBusinessSegment
        )
      : normalizeOptionalString(
          body.customBusinessSegment,
          AI_AGENT_PROFILE_LIMITS.customBusinessSegment
        );

  const departments = parseStringArray(
    body.departments,
    AI_AGENT_DEPARTMENTS,
    "Departamentos",
    { required: true, minItems: 1 }
  );

  const attendantName = parseRequiredString(
    body.attendantName,
    "Nome do atendente",
    AI_AGENT_PROFILE_LIMITS.attendantName
  );
  const attendantRole = normalizeOptionalString(
    body.attendantRole,
    AI_AGENT_PROFILE_LIMITS.attendantRole
  );

  const tone = parseEnumValue(body.tone, AI_AGENT_TONES, "Tom");
  const customTone =
    tone === "custom"
      ? parseRequiredString(
          body.customTone,
          "Tom personalizado",
          AI_AGENT_PROFILE_LIMITS.customTone
        )
      : normalizeOptionalString(body.customTone, AI_AGENT_PROFILE_LIMITS.customTone);

  const clientAddressStyleRaw = body.clientAddressStyle;
  const clientAddressStyle =
    clientAddressStyleRaw == null || String(clientAddressStyleRaw).trim() === ""
      ? null
      : parseEnumValue(
          clientAddressStyleRaw,
          AI_AGENT_CLIENT_ADDRESS_STYLES,
          "Forma de tratar o cliente"
        );

  const emojiLevel = parseEnumValue(
    body.emojiLevel,
    AI_AGENT_EMOJI_LEVELS,
    "Uso de emojis"
  );
  const responseLength = parseEnumValue(
    body.responseLength,
    AI_AGENT_RESPONSE_LENGTHS,
    "Tamanho da resposta"
  );

  const allowedActions = parseStringArray(
    body.allowedActions,
    AI_AGENT_ALLOWED_ACTIONS,
    "Ações permitidas"
  );
  const forbiddenActions = parseStringArray(
    body.forbiddenActions,
    AI_AGENT_FORBIDDEN_ACTIONS,
    "Ações proibidas"
  );
  const handoffRules = ensurePlatformHandoffInvariants(
    parseStringArray(
      body.handoffRules,
      AI_AGENT_HANDOFF_RULES,
      "Regras de handoff"
    )
  );

  return {
    setupMode,
    companyName,
    businessSegment,
    customBusinessSegment,
    departments,
    attendantName,
    attendantRole,
    tone,
    customTone,
    clientAddressStyle,
    emojiLevel,
    responseLength,
    allowedActions,
    forbiddenActions,
    handoffRules,
    companyDescription: normalizeOptionalString(
      body.companyDescription,
      AI_AGENT_PROFILE_LIMITS.companyDescription
    ),
    productsAndServices: normalizeOptionalString(
      body.productsAndServices,
      AI_AGENT_PROFILE_LIMITS.productsAndServices
    ),
    serviceArea: normalizeOptionalString(
      body.serviceArea,
      AI_AGENT_PROFILE_LIMITS.serviceArea
    ),
    businessHours: normalizeOptionalString(
      body.businessHours,
      AI_AGENT_PROFILE_LIMITS.businessHours
    ),
    pricingPolicy: normalizeOptionalString(
      body.pricingPolicy,
      AI_AGENT_PROFILE_LIMITS.pricingPolicy
    ),
    negotiationPolicy: normalizeOptionalString(
      body.negotiationPolicy,
      AI_AGENT_PROFILE_LIMITS.negotiationPolicy
    ),
    schedulingPolicy: normalizeOptionalString(
      body.schedulingPolicy,
      AI_AGENT_PROFILE_LIMITS.schedulingPolicy
    ),
    frequentlyAskedQuestions: parseFaqItems(body.frequentlyAskedQuestions),
    importantInformation: normalizeOptionalString(
      body.importantInformation,
      AI_AGENT_PROFILE_LIMITS.importantInformation
    ),
    customInstructions: normalizeOptionalString(
      body.customInstructions,
      AI_AGENT_PROFILE_LIMITS.customInstructions
    ),
    sourceWebsite: parseOptionalUrl(body.sourceWebsite)
  };
}
