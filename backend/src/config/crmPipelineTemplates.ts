import type { BusinessSegment } from "./businessSegment";

/** Vendas / geral — “Outros” reutiliza o mesmo conjunto de etapas. */
const GENERAL_SALES_STAGES = [
  "Novo lead",
  "Contato iniciado",
  "Qualificado",
  "Proposta enviada",
  "Negociação",
  "Fechado ganho",
  "Perdido"
] as const;

/**
 * Estágios padrão por segmento (catálogo). Marcadores isWon/isLost vêm de crmStageWinLost.
 */
export const crmPipelineTemplates: Record<BusinessSegment, string[]> = {
  general: [...GENERAL_SALES_STAGES],
  support: [
    "Novo chamado",
    "Em triagem",
    "Em atendimento",
    "Aguardando cliente",
    "Resolvido",
    "Reaberto"
  ],
  clinic: [
    "Novo paciente",
    "Triagem",
    "Consulta agendada",
    "Consulta realizada",
    "Tratamento indicado",
    "Retorno",
    "Finalizado"
  ],
  aesthetic_clinic: [
    "Novo lead",
    "Avaliação agendada",
    "Avaliação realizada",
    "Procedimento indicado",
    "Em negociação",
    "Pós-atendimento",
    "Retorno",
    "Fechado",
    "Perdido"
  ],
  real_estate: [
    "Novo lead",
    "Interesse identificado",
    "Imóvel selecionado",
    "Visita agendada",
    "Proposta enviada",
    "Negociação",
    "Fechado",
    "Perdido"
  ],
  gym: [
    "Novo lead",
    "Contato iniciado",
    "Aula experimental",
    "Plano apresentado",
    "Matriculado",
    "Perdido"
  ],
  school: [
    "Novo interessado",
    "Contato iniciado",
    "Apresentação realizada",
    "Proposta enviada",
    "Matrícula realizada",
    "Perdido"
  ],
  ecommerce: [
    "Novo contato",
    "Dúvida sobre produto",
    "Carrinho / intenção",
    "Pagamento pendente",
    "Compra concluída",
    "Pós-venda",
    "Perdido"
  ],
  automotive: [
    "Novo lead",
    "Veículo de interesse",
    "Agendamento de visita",
    "Proposta enviada",
    "Negociação",
    "Venda concluída",
    "Perdido"
  ],
  legal: [
    "Novo contato",
    "Análise inicial",
    "Consulta agendada",
    "Proposta enviada",
    "Contrato fechado",
    "Caso em andamento",
    "Encerrado",
    "Perdido"
  ],
  healthcare: [
    "Novo paciente",
    "Triagem",
    "Consulta agendada",
    "Consulta realizada",
    "Tratamento indicado",
    "Retorno",
    "Finalizado"
  ],
  financial: [
    "Novo lead",
    "Diagnóstico",
    "Proposta enviada",
    "Documentação",
    "Aprovado",
    "Em andamento",
    "Finalizado",
    "Perdido"
  ],
  service: [
    "Solicitação recebida",
    "Orçamento em elaboração",
    "Orçamento enviado",
    "Aprovado",
    "Em execução",
    "Finalizado",
    "Perdido"
  ],
  other: [...GENERAL_SALES_STAGES]
};
