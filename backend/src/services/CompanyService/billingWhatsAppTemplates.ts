/**
 * Textos de aviso de faturação automática (PT-BR).
 * `amountBrl` já vem formatado (ex.: R$ 150,00).
 */

/**
 * Valor efetivo já numérico → exibição moeda BR (sempre definido; nulo/NaN → R$ 0,00).
 */
export function formatBillingAmountBrl(effectiveNumeric: number): string {
  const n =
    typeof effectiveNumeric === "number" && Number.isFinite(effectiveNumeric)
      ? effectiveNumeric
      : Number(effectiveNumeric);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safe);
}

export function templateWarningBeforeDue(
  dueDateLabel: string,
  amountBrl: string
): string {
  return `Olá! Passamos para lembrar que sua mensalidade de ${amountBrl} tem vencimento previsto para ${dueDateLabel}.`;
}

export function templateWarningAfterDue(
  dueDateLabel: string,
  amountBrl: string
): string {
  return `Olá! Identificamos que sua mensalidade de ${amountBrl} tinha vencimento em ${dueDateLabel}. Caso o pagamento já tenha sido feito, por favor desconsidere esta mensagem.`;
}
