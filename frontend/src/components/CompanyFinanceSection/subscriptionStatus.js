/**
 * Rótulos dos três status separados da Central de assinatura (contrato C3).
 * Operação (acesso ao sistema) ≠ Financeiro (situação do vencimento) ≠ Assinatura (em dia ou não).
 * tone: success | warning | error | info | default
 */

const BLOCK_KIND_LABEL = {
  manual: "bloqueio manual",
  financial: "bloqueio financeiro",
  unknown: "motivo desconhecido",
};

export function operationalStatusInfo(operational, blockKind) {
  const op = String(operational || "").toLowerCase();
  if (op === "bloqueada") {
    const kind = BLOCK_KIND_LABEL[String(blockKind || "unknown").toLowerCase()] || BLOCK_KIND_LABEL.unknown;
    return {
      label: `Bloqueada (${kind})`,
      tone: "error",
      help:
        blockKind === "manual"
          ? "Bloqueada manualmente por um administrador. Registrar pagamento NÃO desbloqueia sozinho."
          : blockKind === "financial"
          ? "Bloqueada automaticamente por atraso. Regularizar o pagamento/renovar desbloqueia."
          : "Bloqueada, mas não há registro de quem bloqueou nem por quê.",
    };
  }
  if (op === "ativa") {
    return { label: "Ativa", tone: "success", help: "A empresa consegue usar o sistema." };
  }
  return { label: "Não informada", tone: "default", help: "" };
}

const FINANCIAL = {
  em_dia: { label: "Em dia", tone: "success", help: "O vencimento ainda não chegou." },
  vence_hoje: { label: "Vence hoje", tone: "warning", help: "O vencimento é hoje." },
  carencia: {
    label: "Em carência",
    tone: "warning",
    help: "Vencida, mas ainda dentro do prazo de tolerância antes do bloqueio automático.",
  },
  vencido: {
    label: "Vencido",
    tone: "error",
    help: "Vencida além do prazo de tolerância.",
  },
  sem_vencimento: {
    label: "Sem vencimento",
    tone: "default",
    help: "A empresa não tem data de vencimento cadastrada.",
  },
};

export function financialStatusInfo(financial) {
  return (
    FINANCIAL[String(financial || "").toLowerCase()] || {
      label: "Não informado",
      tone: "default",
      help: "",
    }
  );
}

const SUBSCRIPTION = {
  em_dia: { label: "Em dia", tone: "success", help: "A assinatura está paga/renovada até o vencimento atual." },
  vencida: { label: "Vencida", tone: "error", help: "O vencimento atual já passou." },
  sem_vencimento: { label: "Sem vencimento", tone: "default", help: "Sem data de vencimento cadastrada." },
};

export function subscriptionStatusInfo(subscription) {
  return (
    SUBSCRIPTION[String(subscription || "").toLowerCase()] || {
      label: "Não informada",
      tone: "default",
      help: "",
    }
  );
}

export const STATUS_EXPLANATION =
  "“Operação” diz se a empresa consegue usar o sistema. “Assinatura” diz se o pagamento está em dia. Uma empresa pode estar ativa com a assinatura vencida (e vice-versa).";

/** Texto do atraso/antecedência. */
export function daysText(status) {
  if (!status) return null;
  const late = Number(status.daysLate);
  const until = Number(status.daysUntilDue);
  if (Number.isFinite(late) && late > 0) return `${late} ${late === 1 ? "dia" : "dias"} de atraso`;
  if (Number.isFinite(until) && until > 0) return `vence em ${until} ${until === 1 ? "dia" : "dias"}`;
  return null;
}
