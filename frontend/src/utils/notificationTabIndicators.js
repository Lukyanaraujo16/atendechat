/**
 * Título da aba + favicon com badge quando há mensagens pendentes e a página está oculta.
 */

const BLINK_MS = 2000;
const BADGE_CANVAS_SIZE = 64;

let baseTitle = null;
let blinkTimer = null;
let blinkOn = false;
let pendingCount = 0;
let brandLabel = "StreamHUB Chat";
let originalFaviconHref = null;
let badgeFaviconHref = null;
let faviconPatched = false;

function ensureBaseTitle() {
  if (typeof document === "undefined") return "";
  if (baseTitle == null || baseTitle === "") {
    baseTitle = document.title || brandLabel;
  }
  return baseTitle;
}

function getPrimaryFaviconLink() {
  if (typeof document === "undefined") return null;
  return (
    document.querySelector('link[rel="icon"]') ||
    document.querySelector('link[rel="shortcut icon"]')
  );
}

function captureOriginalFavicon() {
  if (originalFaviconHref) return originalFaviconHref;
  const link = getPrimaryFaviconLink();
  if (link?.href) {
    originalFaviconHref = link.href;
  }
  return originalFaviconHref;
}

function setFaviconHref(href) {
  if (!href || typeof document === "undefined") return;
  let link = getPrimaryFaviconLink();
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "icon");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

function buildBadgeFavicon(sourceHref, count) {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || typeof Image === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = BADGE_CANVAS_SIZE;
        canvas.height = BADGE_CANVAS_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.clearRect(0, 0, BADGE_CANVAS_SIZE, BADGE_CANVAS_SIZE);
        ctx.drawImage(img, 0, 0, BADGE_CANVAS_SIZE, BADGE_CANVAS_SIZE);

        const n = Math.min(99, Number(count) || 0);
        if (n > 0) {
          const r = 14;
          const cx = BADGE_CANVAS_SIZE - r - 2;
          const cy = r + 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = "#e53935";
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 22px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(n > 9 ? "9+" : String(n), cx, cy + 1);
        }
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = sourceHref;
  });
}

function applyTitleFrame() {
  if (typeof document === "undefined") return;
  const base = ensureBaseTitle();
  if (pendingCount <= 0) {
    document.title = base;
    return;
  }
  const label =
    pendingCount === 1
      ? `(1) Nova mensagem — ${brandLabel}`
      : `(${pendingCount}) Novas mensagens — ${brandLabel}`;
  document.title = blinkOn ? label : base;
}

function stopBlink() {
  if (blinkTimer) {
    clearInterval(blinkTimer);
    blinkTimer = null;
  }
  blinkOn = false;
}

async function applyFaviconBadge(count) {
  const source = captureOriginalFavicon();
  if (!source) return;
  if (count <= 0) {
    if (faviconPatched && originalFaviconHref) {
      setFaviconHref(originalFaviconHref);
      faviconPatched = false;
      badgeFaviconHref = null;
    }
    return;
  }
  const dataUrl = await buildBadgeFavicon(source, count);
  if (!dataUrl) return;
  badgeFaviconHref = dataUrl;
  setFaviconHref(dataUrl);
  faviconPatched = true;
}

/**
 * Atualiza indicadores. Com página visível, restaura título/favicon.
 */
export function syncPendingMessageTabIndicators({
  count = 0,
  pageHidden = false,
  systemName,
} = {}) {
  if (typeof document === "undefined") return;

  if (systemName && String(systemName).trim()) {
    brandLabel = String(systemName).trim();
  }

  pendingCount = Math.max(0, Number(count) || 0);
  ensureBaseTitle();
  captureOriginalFavicon();

  if (!pageHidden || pendingCount <= 0) {
    stopBlink();
    document.title = ensureBaseTitle();
    applyFaviconBadge(0);
    return;
  }

  blinkOn = true;
  applyTitleFrame();
  applyFaviconBadge(pendingCount);

  if (!blinkTimer) {
    blinkTimer = setInterval(() => {
      blinkOn = !blinkOn;
      applyTitleFrame();
    }, BLINK_MS);
  }
}

export function resetPendingMessageTabIndicators() {
  pendingCount = 0;
  stopBlink();
  if (typeof document !== "undefined" && baseTitle != null) {
    document.title = baseTitle;
  }
  if (faviconPatched && originalFaviconHref) {
    setFaviconHref(originalFaviconHref);
  }
  faviconPatched = false;
  badgeFaviconHref = null;
  baseTitle = null;
  originalFaviconHref = null;
}

/** Test helpers */
export function __getTabIndicatorStateForTests() {
  return {
    pendingCount,
    baseTitle,
    blinkActive: Boolean(blinkTimer),
    faviconPatched,
    badgeFaviconHref,
  };
}
