import React from "react";
import ReactDOM from "react-dom";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { getThemeOptions } from "../../theme/appThemeOptions";
import SaleReceiptContent from "./SaleReceiptContent";
import {
  DEFAULT_SALE_RECEIPT_PRINT_FORMAT,
  SALE_RECEIPT_PRINT_FORMATS,
  isSaleReceiptPrintFormat,
} from "./saleReceiptPrintFormats";

const PRINT_FRAME_ATTRIBUTE = "data-sale-receipt-print";

/** Tempo máximo à espera de fontes/imagens antes de abrir o diálogo. */
const RESOURCE_TIMEOUT_MS = 1500;

/**
 * Remove o iframe se o browser não disparar afterprint.
 * Caminho normal é afterprint (incluindo Cancelar). Este prazo só evita vazamento.
 */
const CLEANUP_FALLBACK_MS = 120000;

const printTheme = createTheme(getThemeOptions("light"));

/**
 * Margem da página reproduz o padding de impressão anterior (16 mm × 12 mm).
 * O miolo zera o padding do componente para não somar as duas margens.
 * Sem altura fixa: o recibo pode ocupar várias folhas A4.
 */
const A4_PRINT_CSS = `
@page {
  size: A4 portrait;
  margin: 16mm 12mm;
}
html {
  color-scheme: light;
}
html, body {
  margin: 0;
  padding: 0;
  background: #fff !important;
  color: #111 !important;
  font-family: Montserrat, Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.sale-receipt-print-page {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin: 0 auto !important;
  padding: 0 !important;
  background: #fff !important;
  color: #111 !important;
  box-shadow: none !important;
}
.sale-receipt-print-page,
.sale-receipt-print-page * {
  box-sizing: border-box;
}
.sale-receipt-print-page table {
  width: 100%;
  max-width: 100%;
}
.sale-receipt-print-page th,
.sale-receipt-print-page td {
  overflow-wrap: anywhere;
}
.sale-receipt-print-page thead {
  display: table-header-group;
}
.sale-receipt-print-page .sale-receipt-totals {
  break-inside: avoid;
  page-break-inside: avoid;
}
.sale-receipt-print-page .MuiTypography-colorTextSecondary {
  color: #666 !important;
}
`;

/**
 * `size: 80mm auto` é inválido: a gramática aceita um ou dois comprimentos,
 * `auto` sozinho, ou um papel nomeado. O Chromium descarta a declaração inteira
 * quando o segundo valor é `auto`, e a página volta ao papel do diálogo.
 * Um único comprimento vira página quadrada.
 *
 * A largura usada é a área imprimível típica da bobina a 203 dpi:
 * 72 mm em 80 mm nominais (576 pontos) e 48 mm em 58 mm nominais (384 pontos).
 * A altura de 100 mm é o tamanho de cada página. O CSS não expressa
 * “altura igual ao conteúdo”. O espaço vazio fica no fim da última página,
 * no máximo essa altura, e o recibo longo segue na página seguinte.
 * O driver ainda precisa da bobina correspondente.
 */
function thermalPrintCss({ pageSize, fontSize }) {
  return `
@page {
  size: ${pageSize};
  margin: 0;
}
html {
  color-scheme: light;
}
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: auto;
  background: #fff !important;
  color: #111 !important;
  font-family: Montserrat, Roboto, "Helvetica Neue", Arial, sans-serif;
}
.sale-receipt-print-page {
  width: 100%;
  max-width: 100%;
  height: auto;
  box-sizing: border-box;
  margin: 0 !important;
  padding: 0 !important;
  background: #fff !important;
  color: #111 !important;
  box-shadow: none !important;
}
.sale-receipt-thermal,
.sale-receipt-thermal * {
  box-sizing: border-box;
  color: #111 !important;
  background: transparent !important;
  box-shadow: none !important;
  text-shadow: none !important;
}
.sale-receipt-thermal {
  background: #fff !important;
  width: 100%;
  height: auto;
  font-size: ${fontSize};
  line-height: 1.35;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.sale-receipt-thermal-top {
  text-align: center;
  margin-bottom: 6px;
}
.sale-receipt-thermal-title {
  font-weight: 700;
  font-size: 1.15em;
}
.sale-receipt-branding {
  margin-bottom: 6px;
  text-align: center;
  white-space: pre-line;
}
.sale-receipt-branding-trade {
  font-weight: 700;
  font-size: 1.2em;
}
.sale-receipt-branding-line,
.sale-receipt-branding-footer {
  white-space: pre-line;
}
.sale-receipt-branding-footer {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid #111;
  text-align: center;
}
.sale-receipt-thermal-cancelled {
  margin-top: 6px;
  padding: 4px 2px;
  border: 2px solid #111;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-align: center;
}
.sale-receipt-thermal-line {
  margin: 2px 0;
}
.sale-receipt-thermal-label {
  font-weight: 600;
}
.sale-receipt-thermal-rule {
  border: 0;
  border-top: 1px solid #111;
  margin: 6px 0;
}
.sale-receipt-thermal-item {
  margin: 0 0 8px;
}
.sale-receipt-thermal-item-name {
  font-weight: 700;
}
.sale-receipt-thermal-money,
.sale-receipt-thermal-total-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}
.sale-receipt-thermal-total {
  border-top: 2px solid #111;
  margin-top: 4px;
  padding-top: 4px;
  font-weight: 700;
}
.sale-receipt-thermal-notes {
  margin-top: 6px;
  white-space: pre-wrap;
}
`;
}

const PRINT_PROFILES = {
  [SALE_RECEIPT_PRINT_FORMATS.a4]: {
    id: SALE_RECEIPT_PRINT_FORMATS.a4,
    frameWidth: "210mm",
    frameHeight: "297mm",
    css: A4_PRINT_CSS,
  },
  [SALE_RECEIPT_PRINT_FORMATS.thermal80]: {
    id: SALE_RECEIPT_PRINT_FORMATS.thermal80,
    frameWidth: "72mm",
    frameHeight: "200mm",
    css: thermalPrintCss({
      pageSize: "72mm 100mm",
      fontSize: "12px",
    }),
  },
  [SALE_RECEIPT_PRINT_FORMATS.thermal58]: {
    id: SALE_RECEIPT_PRINT_FORMATS.thermal58,
    frameWidth: "48mm",
    frameHeight: "200mm",
    css: thermalPrintCss({
      pageSize: "48mm 100mm",
      fontSize: "11px",
    }),
  },
};

function getPrintProfile(format) {
  const profile = PRINT_PROFILES[format];
  if (!profile) {
    throw new Error("print-format-invalid");
  }
  return profile;
}

let activeJob = null;

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(finish, timeoutMs);
    function finish() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    }
    Promise.resolve(promise).then(finish, finish);
  });
}

function whenSettled(target, eventNames) {
  return new Promise((resolve) => {
    const done = () => resolve();
    eventNames.forEach((name) => {
      target.addEventListener(name, done, { once: true });
    });
  });
}

/**
 * Espera folhas de fonte, fontes e imagens do documento isolado.
 * O CSS da fonte precisa carregar antes de `document.fonts.ready`,
 * senão o status já nasce resolvido e a impressão usa só o fallback.
 * Falha de fonte ou de imagem não bloqueia além do prazo.
 */
export function waitForPrintResources(doc, timeoutMs = RESOURCE_TIMEOUT_MS) {
  const links = Array.from(
    doc.querySelectorAll ? doc.querySelectorAll('link[rel="stylesheet"]') : []
  );
  const stylesReady = Promise.all(
    links.map((link) => (link.sheet ? Promise.resolve() : whenSettled(link, ["load", "error"])))
  ).then(() => {
    if (doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === "function") {
      return doc.fonts.ready;
    }
    return undefined;
  });

  const images = Array.from(doc.querySelectorAll ? doc.querySelectorAll("img") : []);
  const imageReady = images.map((img) =>
    img.complete ? Promise.resolve() : whenSettled(img, ["load", "error"])
  );

  return withTimeout(Promise.all([stylesReady, ...imageReady]), timeoutMs);
}

function copyFontLinks(targetDoc) {
  if (!document.head) return;
  document.head.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute("href") || link.href || "";
    if (!/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(href)) return;
    targetDoc.head.appendChild(link.cloneNode(true));
  });
}

function copyComponentStyles(targetDoc) {
  if (!document.head) return;
  document.head.querySelectorAll("style").forEach((style) => {
    const isComponentStyle =
      style.hasAttribute("data-jss") || style.hasAttribute("data-meta");
    if (!isComponentStyle) return;
    if (style.getAttribute("data-sale-receipt-print-css")) return;
    targetDoc.head.appendChild(style.cloneNode(true));
  });
}

function appendPrintCss(targetDoc, profile) {
  const style = targetDoc.createElement("style");
  style.setAttribute("data-sale-receipt-print-css", profile.id);
  style.textContent = profile.css;
  targetDoc.head.appendChild(style);
}

const PRINT_DOCUMENT_SHELL =
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo</title></head><body></body></html>';

function openStandardsDocument(doc) {
  // Casca estática, sem dado da venda. O doctype tira o iframe do quirks mode.
  doc.open();
  doc.write(PRINT_DOCUMENT_SHELL);
  doc.close();
}

function createPrintFrame(profile) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute(PRINT_FRAME_ATTRIBUTE, profile.id);
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Impressão do recibo");
  iframe.tabIndex = -1;
  // Fora da tela, na largura do perfil. A altura do iframe só organiza o layout;
  // o @page térmico não fixa a altura da bobina. Sem display:none, visibility:hidden
  // ou opacity:0, que em alguns browsers geram página em branco. Sem popup.
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

function destroyPrintFrame(iframe, mount) {
  if (mount && mount.ownerDocument) {
    try {
      ReactDOM.unmountComponentAtNode(mount);
    } catch (error) {
      // O nó pode já ter saído com o iframe.
    }
  }
  if (iframe && iframe.parentNode) {
    iframe.parentNode.removeChild(iframe);
  }
}

function runPrint(sale, format, branding) {
  return new Promise((resolve, reject) => {
    let iframe = null;
    let mount = null;
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
      destroyPrintFrame(iframe, mount);
      reject(error instanceof Error ? error : new Error("print-failed"));
    };

    const succeed = () => {
      if (finished) return;
      finished = true;
      detach();
      destroyPrintFrame(iframe, mount);
      resolve();
    };

    try {
      const profile = getPrintProfile(format);
      iframe = createPrintFrame(profile);
      const initialDoc = iframe.contentDocument;
      if (!initialDoc) {
        throw new Error("print-frame-unavailable");
      }
      openStandardsDocument(initialDoc);
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      if (!doc || !doc.body || !doc.head || !win) {
        throw new Error("print-frame-unavailable");
      }

      doc.title = "Recibo";
      mount = doc.createElement("div");
      mount.id = "sale-receipt-mount";
      doc.body.appendChild(mount);

      ReactDOM.render(
        <ThemeProvider theme={printTheme}>
          <SaleReceiptContent
            sale={sale}
            layout="print"
            format={profile.id}
            branding={branding}
          />
        </ThemeProvider>,
        mount
      );

      copyFontLinks(doc);
      copyComponentStyles(doc);
      appendPrintCss(doc, profile);

      waitForPrintResources(doc)
        .then(() => {
          if (finished) return;
          win.addEventListener("afterprint", succeed);
          window.addEventListener("afterprint", succeed);
          fallbackTimer = setTimeout(succeed, CLEANUP_FALLBACK_MS);
          try {
            if (typeof win.focus === "function") {
              win.focus();
            }
          } catch (error) {
            // Foco é opcional. Alguns ambientes (jsdom) não implementam focus.
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

/**
 * Imprime o recibo num iframe isolado. Chamadas sobrepostas reutilizam o mesmo trabalho.
 * Dados da venda entram só pelo React, nunca por concatenação de HTML.
 */
export function printSaleReceipt(
  sale,
  format = DEFAULT_SALE_RECEIPT_PRINT_FORMAT,
  branding = null
) {
  if (!isSaleReceiptPrintFormat(format)) {
    return Promise.reject(new Error("print-format-invalid"));
  }
  if (activeJob) return activeJob;
  activeJob = runPrint(sale, format, branding).finally(() => {
    activeJob = null;
  });
  return activeJob;
}
