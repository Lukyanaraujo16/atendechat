/**
 * Rótulos da fila de revisão de faturas históricas (Fase 8.4-F, contrato C5).
 * Os sinais são INDÍCIOS para ajudar a decisão — nunca prova de pagamento.
 */

/** Estado padrão da fila: pendentes + mantidas pendentes (bate com o contador do resumo). */
export const DEFAULT_STATE = "unresolved";

export const STATE_OPTIONS = [
  { value: "unresolved", label: "Não resolvidas" },
  { value: "pending", label: "Pendentes de revisão" },
  { value: "kept_pending", label: "Mantidas pendentes" },
  { value: "resolved", label: "Resolvidas" },
  { value: "all", label: "Todas" },
];

export const DECISION_LABELS = {
  historical_payment: "Pagamento histórico registrado",
  improper_cancel: "Cancelada (cobrança indevida)",
  historical_courtesy: "Cortesia histórica",
  keep_pending: "Mantida pendente",
};

export function decisionLabel(decision) {
  return DECISION_LABELS[decision] || decision || "—";
}

/** Situação da fatura na fila. */
export function reviewSituation(item) {
  const decision = item?.review?.decision;
  if (!decision) return { label: "Pendente de revisão", tone: "warning", canReview: true };
  if (decision === "keep_pending") return { label: "Mantida pendente", tone: "info", canReview: true };
  return { label: `Resolvida: ${decisionLabel(decision)}`, tone: "success", canReview: false };
}

/** Lista de indícios legíveis a partir de `signals`. */
export function signalList(signals) {
  if (!signals || typeof signals !== "object") return [];
  const out = [];
  if (signals.coveredByCurrentDueDate) {
    out.push({
      key: "covered",
      label: "Vencimento atual já cobre o período",
      help: "O vencimento atual da empresa já passa do fim do ciclo desta fatura. Pode indicar que foi paga por fora — ou que houve renovação sem pagamento.",
    });
  }
  const renewals = Number(signals.adminRenewalsAfterDue) || 0;
  if (renewals > 0) {
    out.push({
      key: "renewals",
      label:
        renewals === 1
          ? "1 renovação manual depois do vencimento"
          : `${renewals} renovações manuais depois do vencimento`,
      help: "Um administrador renovou a assinatura depois do vencimento desta fatura. Renovação manual não registra pagamento.",
    });
  }
  if (signals.efiCharge) {
    out.push({
      key: "efi",
      label: "Cobrança Efí gerada",
      help: "Existe cobrança Pix/boleto gerada na Efí para esta fatura. Confira no painel da Efí antes de decidir.",
    });
  }
  if (signals.pendingReconciliation) {
    out.push({
      key: "recon",
      label: "Conciliação pendente",
      help: "Há um item de conciliação aberto para esta fatura. Resolva a conciliação primeiro.",
    });
  }
  return out;
}
