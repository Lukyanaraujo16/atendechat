import type { BusinessSegment } from "./businessSegment";

/**
 * Estágios padrão por segmento (catálogo). Marcadores “ganho/perda” aplicados no bootstrap
 * com base no nome (Fechado, Matriculado = ganho; Perdido = perda).
 */
export const crmPipelineTemplates: Record<BusinessSegment, string[]> = {
  general: [
    "Novo lead",
    "Em atendimento",
    "Em negociação",
    "Fechado",
    "Perdido"
  ],
  clinic: [
    "Novo lead",
    "Triagem",
    "Consulta agendada",
    "Em negociação",
    "Fechado",
    "Perdido"
  ],
  aesthetic_clinic: [
    "Novo lead",
    "Avaliação agendada",
    "Procedimento indicado",
    "Em negociação",
    "Fechado",
    "Perdido"
  ],
  real_estate: [
    "Novo lead",
    "Interesse identificado",
    "Visita agendada",
    "Proposta enviada",
    "Fechado",
    "Perdido"
  ],
  gym: [
    "Novo lead",
    "Aula experimental",
    "Plano apresentado",
    "Matriculado",
    "Perdido"
  ],
  school: [
    "Novo lead",
    "Visita à escola",
    "Matrícula em análise",
    "Matriculado",
    "Perdido"
  ],
  ecommerce: [
    "Novo lead",
    "Carrinho / interesse",
    "Negociação",
    "Pedido fechado",
    "Perdido"
  ],
  automotive: [
    "Novo lead",
    "Test-drive",
    "Proposta",
    "Fechado",
    "Perdido"
  ],
  financial: [
    "Novo lead",
    "Análise",
    "Proposta",
    "Fechado",
    "Perdido"
  ],
  legal: [
    "Novo lead",
    "Consulta inicial",
    "Contrato / proposta",
    "Fechado",
    "Perdido"
  ],
  healthcare: [
    "Novo lead",
    "Triagem",
    "Atendimento",
    "Fechado",
    "Perdido"
  ],
  other: [
    "Novo lead",
    "Em atendimento",
    "Em negociação",
    "Fechado",
    "Perdido"
  ]
};
