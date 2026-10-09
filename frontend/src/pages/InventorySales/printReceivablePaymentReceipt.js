import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import { i18n } from "../../translate/i18n";
import { getInventoryPaymentMethodLabel } from "./paymentDisplay";

/**
 * Comprovante simples de recebimento (Contas a Receber).
 * Não altera recibos A4/80/58 de venda.
 * amount = valor efetivamente recebido nesta operação (não saldo residual).
 *
 * Usa Blob URL + window.open para evitar aba branca: com
 * `noopener` o browser abre a aba mas `window.open` retorna null,
 * então document.write nunca rodava.
 */
export function printReceivablePaymentReceipt({
  customerName,
  customerDocument,
  amount,
  paymentMethod,
  paidAt,
  notes,
  allocations = [],
  remainingOpenAmount = null,
}) {
  const paidLabel = paidAt
    ? new Date(paidAt).toLocaleString("pt-BR")
    : new Date().toLocaleString("pt-BR");

  const rows = (allocations || [])
    .map(
      (a) =>
        `<tr>
          <td>${a.saleNumber != null ? `#${a.saleNumber}` : "—"}</td>
          <td>${a.sequence != null ? a.sequence : "—"}</td>
          <td>${a.dueDate || "—"}</td>
          <td style="text-align:right">${formatCurrencyBRL(a.amount)}</td>
          ${
            a.openAmountAfter != null
              ? `<td style="text-align:right">${formatCurrencyBRL(
                  a.openAmountAfter
                )}</td>`
              : ""
          }
        </tr>`
    )
    .join("");

  const showRemainingCol = (allocations || []).some(
    (a) => a.openAmountAfter != null
  );

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${i18n.t("inventorySales.receivables.receipt.title")}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 12px; }
  .meta { margin-bottom: 16px; font-size: 14px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border-bottom: 1px solid #ddd; padding: 8px; font-size: 13px; text-align: left; }
  th { font-weight: 600; }
  .total { margin-top: 16px; font-size: 16px; font-weight: 700; }
  .remaining { margin-top: 8px; font-size: 13px; color: #444; }
</style>
</head>
<body>
  <h1>${i18n.t("inventorySales.receivables.receipt.title")}</h1>
  <div class="meta">
    <div><strong>${i18n.t("inventorySales.customers.columns.name")}:</strong> ${
      customerName || "—"
    }</div>
    ${
      customerDocument
        ? `<div><strong>${i18n.t(
            "inventorySales.customers.columns.document"
          )}:</strong> ${customerDocument}</div>`
        : ""
    }
    <div><strong>${i18n.t(
      "inventorySales.receivables.columns.method"
    )}:</strong> ${getInventoryPaymentMethodLabel(paymentMethod)}</div>
    <div><strong>${i18n.t(
      "inventorySales.customers.account.paidAt"
    )}:</strong> ${paidLabel}</div>
    ${
      notes
        ? `<div><strong>${i18n.t(
            "inventorySales.common.notes"
          )}:</strong> ${notes}</div>`
        : ""
    }
  </div>
  ${
    rows
      ? `<table>
    <thead>
      <tr>
        <th>${i18n.t("inventorySales.receivables.columns.sale")}</th>
        <th>${i18n.t("inventorySales.receivables.columns.installment")}</th>
        <th>${i18n.t("inventorySales.receivables.columns.dueDate")}</th>
        <th style="text-align:right">${i18n.t(
          "inventorySales.receivables.receipt.allocated"
        )}</th>
        ${
          showRemainingCol
            ? `<th style="text-align:right">${i18n.t(
                "inventorySales.receivables.receipt.remainingOnInstallment"
              )}</th>`
            : ""
        }
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
      : ""
  }
  <div class="total" data-testid="receivable-receipt-amount">${i18n.t(
    "inventorySales.receivables.receipt.amount"
  )}: ${formatCurrencyBRL(amount)}</div>
  ${
    remainingOpenAmount != null
      ? `<div class="remaining" data-testid="receivable-receipt-remaining">${i18n.t(
          "inventorySales.receivables.receipt.remainingOpen"
        )}: ${formatCurrencyBRL(remainingOpenAmount)}</div>`
      : ""
  }
  <script>
    window.addEventListener("load", function () {
      try { window.focus(); window.print(); } catch (e) {}
    });
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  // Mesmo com noopener (retorno null), a URL é carregada na nova aba —
  // evita aba órfã em branco que ocorriam com document.write após open("", …).
  const win = window.open(
    url,
    "_blank",
    "noopener,noreferrer,width=720,height=800"
  );
  const revoke = () => {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {
      /* ignore */
    }
  };
  if (win) {
    const t = setTimeout(revoke, 120000);
    try {
      win.addEventListener("afterprint", () => {
        clearTimeout(t);
        revoke();
        try {
          win.close();
        } catch (_) {
          /* ignore */
        }
      });
    } catch (_) {
      /* ignore */
    }
  } else {
    setTimeout(revoke, 120000);
  }
  return { url, window: win };
}
