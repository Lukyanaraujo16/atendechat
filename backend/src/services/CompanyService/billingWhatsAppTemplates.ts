/**
 * Textos de aviso de faturação (PT-BR). Futuro: SystemSettings ou i18n por tenant.
 */
export function templateWarningBeforeDue(dueDateLabel: string): string {
  return `Olá! Passando para lembrar que o vencimento do seu plano está previsto para ${dueDateLabel}.`;
}

export function templateWarningAfterDue(dueDateLabel: string): string {
  return `Olá! Identificamos que o vencimento do seu plano ocorreu em ${dueDateLabel}. Caso o pagamento já tenha sido feito, por favor desconsidere esta mensagem.`;
}
