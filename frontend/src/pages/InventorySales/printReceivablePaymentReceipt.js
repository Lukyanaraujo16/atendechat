import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import { i18n } from "../../translate/i18n";
import { getInventoryReceiptBranding } from "../../services/inventoryApi";
import { getInventoryPaymentMethodLabel } from "./paymentDisplay";
import {
  EMPTY_RECEIPT_BRANDING,
  hasReceiptBrandingFooter,
  hasReceiptBrandingHeader,
  receiptBrandingFromSettings,
  receiptPrintFormatFromPayload,
} from "./receiptBranding";
import {
  DEFAULT_SALE_RECEIPT_PRINT_FORMAT,
  isThermalSaleReceiptFormat,
} from "./saleReceiptPrintFormats";
import {
  getPrintProfile,
  waitForPrintResources,
} from "./printSaleReceipt";
import { formatCivilDueDate } from "./storeCreditInstallmentDisplay";
import { formatInventoryCustomerDocument } from "./inventoryCustomerMasks";

const PRINT_FRAME_ATTRIBUTE = "data-receivable-receipt-print";
const CLEANUP_FALLBACK_MS = 120000;

const RECEIVABLE_CONTENT_CSS = `
.receivable-receipt-line { margin: 3px 0; }
.receivable-receipt-label { font-weight: 600; }
.receivable-receipt-amount {
  margin: 10px 0 8px;
  padding: 8px 2px;
  border-top: 2px solid #111;
  border-bottom: 2px solid #111;
  font-weight: 700;
  font-size: 1.15em;
  text-align: center;
}
.receivable-receipt-alloc {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed #999;
}
.receivable-receipt-alloc-row { margin: 2px 0; font-size: 0.95em; }
.sale-receipt-branding { margin-bottom: 6px; text-align: center; white-space: pre-line; }
.sale-receipt-branding-trade { font-weight: 700; font-size: 1.2em; }
.sale-receipt-branding-logo {
  display: block; margin: 0 auto 4px; max-width: 48mm; max-height: 16mm;
  width: auto; height: auto; object-fit: contain;
}
.sale-receipt-branding-line, .sale-receipt-branding-footer { white-space: pre-line; }
.sale-receipt-branding-footer {
  margin-top: 8px; padding-top: 6px; border-top: 1px solid #111; text-align: center;
}
.sale-receipt-thermal-top { text-align: center; margin-bottom: 6px; }
.sale-receipt-thermal-title { font-weight: 700; font-size: 1.15em; }
.sale-receipt-a4-title {
  font-weight: 700; font-size: 18px; text-align: center; margin: 0 0 12px;
}
`;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function line(label, value) {
  if (value == null || value === "") return "";
  return `<div class="receivable-receipt-line"><span class="receivable-receipt-label">${escapeHtml(
    label
  )}:</span> ${escapeHtml(value)}</div>`;
}

function buildBrandingHtml(branding) {
  if (!branding) return "";
  const hasText = hasReceiptBrandingHeader(branding);
  const hasLogo = Boolean(branding.logoUrl);
  if (!hasText && !hasLogo) return "";
  const prominent = hasText ? branding.tradeName || branding.legalName : "";
  const legalBelow = Boolean(hasText && branding.tradeName && branding.legalName);
  const documentLabel = i18n.t("inventorySales.sales.receipt.branding.document");
  const phoneLabel = i18n.t("inventorySales.sales.receipt.branding.phone");
  return `<div class="sale-receipt-branding">
    ${
      hasLogo
        ? `<img class="sale-receipt-branding-logo" src="${escapeHtml(
            branding.logoUrl
          )}" alt="" />`
        : ""
    }
    ${
      prominent
        ? `<div class="sale-receipt-branding-trade">${escapeHtml(
            prominent
          )}</div>`
        : ""
    }
    ${
      legalBelow
        ? `<div class="sale-receipt-branding-line">${escapeHtml(
            branding.legalName
          )}</div>`
        : ""
    }
    ${
      branding.document
        ? `<div class="sale-receipt-branding-line">${escapeHtml(
            documentLabel
          )}: ${escapeHtml(branding.document)}</div>`
        : ""
    }
    ${
      branding.address
        ? `<div class="sale-receipt-branding-line">${escapeHtml(
            branding.address
          )}</div>`
        : ""
    }
    ${
      branding.phone
        ? `<div class="sale-receipt-branding-line">${escapeHtml(
            phoneLabel
          )}: ${escapeHtml(branding.phone)}</div>`
        : ""
    }
  </div>`;
}

function buildFooterHtml(branding) {
  if (!hasReceiptBrandingFooter(branding)) return "";
  return `<div class="sale-receipt-branding-footer">${escapeHtml(
    branding.footerMessage
  )}</div>`;
}

/**
 * Monta o HTML do miolo (sem produtos de venda).
 * Exportado para testes unitários sem iframe.
 */
export function buildReceivablePaymentReceiptHtml({
  customerName,
  customerDocument,
  amount,
  paymentMethod,
  paidAt,
  notes,
  allocations = [],
  remainingOpenAmount = null,
  previousOpenAmount = null,
  saleNumber = null,
  operatorName = null,
  paymentId = null,
  branding = null,
  format = DEFAULT_SALE_RECEIPT_PRINT_FORMAT,
}) {
  const thermal = isThermalSaleReceiptFormat(format);
  const paidLabel = paidAt
    ? new Date(paidAt).toLocaleString(
        String(i18n.language || "pt").startsWith("en") ? "en-US" : "pt-BR"
      )
    : new Date().toLocaleString(
        String(i18n.language || "pt").startsWith("en") ? "en-US" : "pt-BR"
      );
  const title = i18n.t("inventorySales.receivables.receipt.title");
  const amountLabel = i18n.t("inventorySales.receivables.receipt.amount");
  const docFormatted = customerDocument
    ? formatInventoryCustomerDocument(customerDocument)
    : "";

  const allocHtml = (allocations || [])
    .map((a) => {
      const parts = [];
      if (a.saleNumber != null) {
        parts.push(
          `${i18n.t("inventorySales.receivables.columns.sale")} #${a.saleNumber}`
        );
      }
      if (a.sequence != null) {
        parts.push(
          i18n.t("inventorySales.sales.wizard.payment.installmentLine", {
            n: a.sequence,
          })
        );
      }
      if (a.dueDate) {
        parts.push(
          `${i18n.t(
            "inventorySales.receivables.columns.dueDate"
          )}: ${formatCivilDueDate(a.dueDate)}`
        );
      }
      if (a.amount != null) {
        parts.push(formatCurrencyBRL(a.amount));
      }
      return `<div class="receivable-receipt-alloc-row">${escapeHtml(
        parts.join(" · ")
      )}</div>`;
    })
    .join("");

  const body = `
    ${buildBrandingHtml(branding)}
    <div class="${thermal ? "sale-receipt-thermal-top" : ""}">
      <div class="${
        thermal ? "sale-receipt-thermal-title" : "sale-receipt-a4-title"
      }" data-testid="receivable-receipt-title">${escapeHtml(title)}</div>
    </div>
    ${paymentId != null ? line(i18n.t("inventorySales.receivables.receipt.receiptId"), String(paymentId)) : ""}
    ${line(i18n.t("inventorySales.customers.columns.name"), customerName || "—")}
    ${docFormatted ? line(i18n.t("inventorySales.customers.columns.document"), docFormatted) : ""}
    ${
      saleNumber != null
        ? line(i18n.t("inventorySales.receivables.columns.sale"), `#${saleNumber}`)
        : ""
    }
    ${line(
      i18n.t("inventorySales.receivables.columns.method"),
      getInventoryPaymentMethodLabel(paymentMethod)
    )}
    ${line(i18n.t("inventorySales.customers.account.paidAt"), paidLabel)}
    ${
      operatorName
        ? line(
            i18n.t("inventorySales.customers.account.operator"),
            operatorName
          )
        : ""
    }
    ${
      previousOpenAmount != null
        ? line(
            i18n.t("inventorySales.receivables.receipt.previousOpen"),
            formatCurrencyBRL(previousOpenAmount)
          )
        : ""
    }
    <div class="receivable-receipt-amount" data-testid="receivable-receipt-amount">${escapeHtml(
      amountLabel
    )}: ${escapeHtml(formatCurrencyBRL(amount))}</div>
    ${
      remainingOpenAmount != null
        ? `<div class="receivable-receipt-line" data-testid="receivable-receipt-remaining"><span class="receivable-receipt-label">${escapeHtml(
            i18n.t("inventorySales.receivables.receipt.remainingOpen")
          )}:</span> ${escapeHtml(
            formatCurrencyBRL(remainingOpenAmount)
          )}</div>`
        : ""
    }
    ${
      notes
        ? line(i18n.t("inventorySales.common.notes"), notes)
        : ""
    }
    ${
      allocHtml
        ? `<div class="receivable-receipt-alloc" data-testid="receivable-receipt-allocations">${allocHtml}</div>`
        : ""
    }
    ${buildFooterHtml(branding)}
  `;

  const pageClass = thermal
    ? "sale-receipt-print-page sale-receipt-thermal"
    : "sale-receipt-print-page";

  return `<div class="${pageClass}" data-testid="receivable-receipt-root" data-print-format="${escapeHtml(
    format
  )}">${body}</div>`;
}

function createPrintFrame(profile) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute(PRINT_FRAME_ATTRIBUTE, profile.id);
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Impressão do comprovante de recebimento");
  iframe.tabIndex = -1;
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = profile.frameWidth;
  iframe.style.height = profile.frameHeight;
  iframe.style.border = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);
  return iframe;
}

function destroyPrintFrame(iframe) {
  if (iframe && iframe.parentNode) {
    iframe.parentNode.removeChild(iframe);
  }
}

function openStandardsDocument(doc) {
  doc.open();
  doc.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title></title></head><body></body></html>'
  );
  doc.close();
}

function copyFontLinks(targetDoc) {
  if (!document.head) return;
  document.head.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute("href") || link.href || "";
    if (!/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(href)) return;
    targetDoc.head.appendChild(link.cloneNode(true));
  });
}

async function resolveBrandingAndFormat(input) {
  if (input.branding && input.format) {
    return { branding: input.branding, format: input.format };
  }
  try {
    const { data } = await getInventoryReceiptBranding();
    return {
      branding: input.branding || receiptBrandingFromSettings(data),
      format: input.format || receiptPrintFormatFromPayload(data),
    };
  } catch (_) {
    return {
      branding: input.branding || { ...EMPTY_RECEIPT_BRANDING },
      format: input.format || DEFAULT_SALE_RECEIPT_PRINT_FORMAT,
    };
  }
}

/**
 * Comprovante de recebimento no padrão visual do cupom de venda
 * (branding + formato 58/80/A4 via getPrintProfile).
 * Usa iframe oculto (mesma estratégia do recibo de venda) — sem aba branca.
 */
export async function printReceivablePaymentReceipt(input = {}) {
  const { branding, format } = await resolveBrandingAndFormat(input);
  const profile = getPrintProfile(format);
  const innerHtml = buildReceivablePaymentReceiptHtml({
    ...input,
    branding,
    format,
  });

  return new Promise((resolve, reject) => {
    let iframe = null;
    let finished = false;
    let fallbackTimer = null;

    const detach = () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      const win = iframe && iframe.contentWindow;
      if (win) win.removeEventListener("afterprint", succeed);
      window.removeEventListener("afterprint", succeed);
    };

    const fail = (error) => {
      if (finished) return;
      finished = true;
      detach();
      destroyPrintFrame(iframe);
      reject(error instanceof Error ? error : new Error("print-failed"));
    };

    const succeed = () => {
      if (finished) return;
      finished = true;
      detach();
      destroyPrintFrame(iframe);
      resolve({ format, branding });
    };

    try {
      iframe = createPrintFrame(profile);
      const initialDoc = iframe.contentDocument;
      if (!initialDoc) throw new Error("print-frame-unavailable");
      openStandardsDocument(initialDoc);
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      if (!doc || !doc.body || !doc.head || !win) {
        throw new Error("print-frame-unavailable");
      }

      doc.title = i18n.t("inventorySales.receivables.receipt.title");
      const mount = doc.createElement("div");
      mount.id = "sale-receipt-mount";
      mount.innerHTML = innerHtml;
      doc.body.appendChild(mount);

      const style = doc.createElement("style");
      style.setAttribute("data-receivable-receipt-print-css", profile.id);
      style.textContent = `${profile.css}\n${RECEIVABLE_CONTENT_CSS}`;
      doc.head.appendChild(style);
      copyFontLinks(doc);

      waitForPrintResources(doc)
        .then(() => {
          if (finished) return;
          win.addEventListener("afterprint", succeed);
          window.addEventListener("afterprint", succeed);
          fallbackTimer = setTimeout(succeed, CLEANUP_FALLBACK_MS);
          try {
            if (typeof win.focus === "function") win.focus();
          } catch (_) {
            /* optional */
          }
          try {
            if (typeof win.print !== "function") {
              throw new Error("print-unavailable");
            }
            win.print();
          } catch (error) {
            fail(error);
          }
        })
        .catch(fail);
    } catch (error) {
      fail(error);
    }
  });
}
