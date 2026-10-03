import React from "react";
import ReactDOM from "react-dom";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { getThemeOptions } from "../../theme/appThemeOptions";
import SaleReceiptContent from "./SaleReceiptContent";

/**
 * Perfil único desta fase. Um perfil futuro escolhe outra folha;
 * 80 mm e 58 mm não existem aqui.
 */
const PRINT_PROFILE = "a4";

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

function appendPrintCss(targetDoc) {
  const style = targetDoc.createElement("style");
  style.setAttribute("data-sale-receipt-print-css", PRINT_PROFILE);
  style.textContent = A4_PRINT_CSS;
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

function createPrintFrame() {
  const iframe = document.createElement("iframe");
  iframe.setAttribute(PRINT_FRAME_ATTRIBUTE, PRINT_PROFILE);
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Impressão do recibo");
  iframe.tabIndex = -1;
  // Fora da tela, com largura A4. Sem display:none, visibility:hidden ou opacity:0,
  // que em alguns browsers geram página em branco. Sem popup.
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "210mm";
  iframe.style.height = "297mm";
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

function runPrint(sale) {
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
      iframe = createPrintFrame();
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
          <SaleReceiptContent sale={sale} layout="print" />
        </ThemeProvider>,
        mount
      );

      copyFontLinks(doc);
      copyComponentStyles(doc);
      appendPrintCss(doc);

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
export function printSaleReceipt(sale) {
  if (activeJob) return activeJob;
  activeJob = runPrint(sale).finally(() => {
    activeJob = null;
  });
  return activeJob;
}
