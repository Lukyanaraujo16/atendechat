/**
 * Classificação de estágio CRM (ganho / perda / aberto) a partir do nome exibido.
 * Usado no bootstrap de pipelines para definir isWon / isLost.
 */
export function normalizeStageLabel(name: string): string {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Nomes que representam conclusão com sucesso (não “venda” em todos os segmentos).
 * Correspondência exata após normalização (sem acentos, minúsculas).
 */
const WON_NORMALIZED = new Set([
  "fechado ganho",
  "fechado",
  "resolvido",
  "matriculado",
  "matricula realizada",
  "compra concluida",
  "venda concluida",
  "finalizado",
  "encerrado",
  "pedido fechado",
  "aprovado"
]);

export function stageWinLostFromName(name: string): {
  isWon: boolean;
  isLost: boolean;
} {
  const raw = String(name || "").trim();
  const n = normalizeStageLabel(raw);

  if (n.includes("perdido")) {
    return { isWon: false, isLost: true };
  }

  /** Estágios explicitamente não-terminais com palavras parecidas */
  if (n.includes("reaberto")) {
    return { isWon: false, isLost: false };
  }
  if (n.includes("caso em andamento")) {
    return { isWon: false, isLost: false };
  }

  if (WON_NORMALIZED.has(n)) {
    return { isWon: true, isLost: false };
  }

  return { isWon: false, isLost: false };
}
