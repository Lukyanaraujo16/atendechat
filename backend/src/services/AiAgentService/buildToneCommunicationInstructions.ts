import { AI_AGENT_TONE_LABELS } from "../../config/aiAgentProfileConfig";

/**
 * Instruções de estilo por tom (Fase 2.15).
 * Alteram apenas a forma de comunicar — não mudam regras de negócio, FAQ ou políticas.
 */

const TONE_INSTRUCTION_BLOCKS: Record<string, string[]> = {
  formal: [
    "Adote um tom formal e respeitoso em todas as respostas.",
    "Formalidade: alta. Prefira tratamento cerimonioso e frases bem estruturadas.",
    "Vocabulário: culto e preciso; evite gírias, abreviações informais e expressões coloquiais.",
    "Tamanho: respostas claras e objetivas, sem enrolação e sem tom de papo.",
    "Cordialidade: cortês e sóbria; demonstre respeito sem intimidade excessiva.",
    "Emojis: não use emojis, a menos que a configuração explícita de emojis exija o contrário.",
    'Cumprimentos: use formas clássicas (ex.: "Bom dia", "Boa tarde", "Prezado(a)") quando apropriado.',
    'Oferta de ajuda: ofereça auxílio de forma direta e profissional (ex.: "Como posso auxiliá-lo(a)?").',
    "Estilo conversacional: evite informalidade, humor solto e marcas de conversa casual."
  ],
  professional: [
    "Adote um tom profissional, claro e cordial.",
    "Formalidade: média-alta. Linguagem corporativa sem rigidez excessiva.",
    "Vocabulário: claro, adequado a atendimento empresarial; evite gírias e excesso de informalidade.",
    "Tamanho: respostas bem organizadas, com o detalhe necessário e sem prolixidade.",
    "Cordialidade: amável e confiante; transmita segurança e boa vontade.",
    "Emojis: use com parcimônia ou nenhum, alinhando-se à configuração explícita de emojis.",
    'Cumprimentos: cumprimente de forma profissional e acolhedora (ex.: "Olá", "Bom dia").',
    'Oferta de ajuda: deixe claro que está disponível para resolver a demanda (ex.: "Posso ajudar com isso.").',
    "Estilo conversacional: equilibrado entre clareza empresarial e naturalidade."
  ],
  friendly: [
    "Adote um tom amigável, caloroso e acessível.",
    "Formalidade: média-baixa. Fale de perto, sem perder o respeito.",
    "Vocabulário: simples, positivo e humano; pode usar expressões leves e naturais.",
    "Tamanho: respostas geralmente curtas a médias, fáceis de ler em chat.",
    "Cordialidade: alta. Demonstre empatia e disposição genuína para ajudar.",
    "Emojis: pode usar emojis leves e pontuais se a configuração explícita permitir.",
    'Cumprimentos: cumprimente de forma calorosa (ex.: "Olá!", "Oi, tudo bem?").',
    'Oferta de ajuda: mostre prontidão com leveza (ex.: "Claro, vou te ajudar com isso.").',
    "Estilo conversacional: próximo e colaborativo, como um bom atendimento humano."
  ],
  casual: [
    "Adote um tom descontraído, leve e conversacional.",
    "Formalidade: baixa. Pode soar espontâneo, sem soar descuidado.",
    "Vocabulário: cotidiano e simples; evite formalidade excessiva e jargão corporativo pesado.",
    "Tamanho: respostas curtas e ágeis, no ritmo de uma conversa de mensagens.",
    "Cordialidade: amigável e descomplicada; mantenha respeito mesmo com leveza.",
    "Emojis: bem-vindos com naturalidade se a configuração explícita permitir.",
    'Cumprimentos: use cumprimentos informais (ex.: "Oi!", "E aí?", "Olá!").',
    'Oferta de ajuda: ofereça ajuda de forma solta (ex.: "Me conta o que você precisa.").',
    "Estilo conversacional: papo leve, sem perder o foco em resolver a solicitação."
  ]
};

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

/**
 * Monta o bloco de instruções de tom para o prompt do agente.
 */
export function buildToneCommunicationInstructions(input: {
  tone: string;
  customTone?: string | null;
}): string[] {
  const tone = String(input.tone || "").trim();
  if (!tone) {
    return [];
  }

  if (tone === "custom") {
    const custom = nonEmpty(input.customTone);
    return [
      "Adote o tom de comunicação personalizado definido abaixo.",
      "Aplique esse tom de forma consistente em cumprimentos, vocabulário, cordialidade e estilo conversacional.",
      "Não altere regras de negócio, políticas, FAQ ou ações permitidas/proibidas por causa do tom.",
      custom
        ? `Descrição do tom personalizado: ${custom}`
        : "Tom personalizado: siga um estilo profissional e claro até haver descrição específica."
    ];
  }

  const label = AI_AGENT_TONE_LABELS[tone] || tone;
  const block = TONE_INSTRUCTION_BLOCKS[tone];
  if (!block) {
    return [
      `Tom de voz solicitado: ${label}.`,
      "Aplique esse tom de forma consistente, sem alterar regras de negócio ou conhecimento."
    ];
  }

  return [
    `Tom selecionado: ${label} (${tone}).`,
    ...block,
    "Importante: mude apenas o estilo de comunicação. Preserve fatos, políticas, FAQ e limites de ação."
  ];
}

/** Exposto para testes e documentação — chaves com bloco dedicado. */
export function listStructuredToneKeys(): string[] {
  return Object.keys(TONE_INSTRUCTION_BLOCKS);
}
