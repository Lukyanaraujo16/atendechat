/**
 * Exibe totais de pagamento alinhados a sale.totalAmount (autoritativo).
 * Evita divergência quando o bundle de pagamentos ainda não foi recarregado
 * após alteração de desconto global / frete / itens.
 */
function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function resolvePaymentSummaryDisplay(sale, summary) {
  const saleTotal = roundMoney(sale?.totalAmount ?? 0);
  if (!summary) {
    return {
      totalAmount: saleTotal,
      effectivePaid: 0,
      pendingAmount: 0,
      remainingToAllocate: saleTotal,
    };
  }

  const effectivePaid = roundMoney(summary.effectivePaid ?? 0);
  const pendingAmount = roundMoney(summary.pendingAmount ?? 0);
  const remainingToAllocate = roundMoney(
    saleTotal - effectivePaid - pendingAmount
  );

  return {
    ...summary,
    totalAmount: saleTotal,
    effectivePaid,
    pendingAmount,
    remainingToAllocate: remainingToAllocate > 0 ? remainingToAllocate : 0,
  };
}
