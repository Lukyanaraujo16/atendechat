/**
 * URL base do Express (REST + /public + Socket.io).
 *
 * 1) REACT_APP_BACKEND_URL no .env (build) — URL completa, sem barra final.
 * 2) Se vazio: no navegador, mesmo protocolo/host da página + REACT_APP_BACKEND_PORT (padrão 8080).
 *
 * Importante: pedidos relativos na origem do SPA (ex.: só hostname:80) enviam POST para o Nginx
 * estático — rotas como /system-settings/branding devolvem 405. Sempre apontar para a porta do Node
 * ou configurar proxy Nginx para o backend.
 *
 * HTTPS: se o painel abre em https:// e REACT_APP_BACKEND_URL for http://, o browser bloqueia
 * (conteúdo misto). Use URL https:// na API, ou prefixo //host (protocolo herdado da página),
 * ou deixe o código alinhar http→https quando a página for HTTPS (a API tem de responder em TLS).
 */
export function resolveBackendBaseURL() {
  let fromEnv = (process.env.REACT_APP_BACKEND_URL || "").trim().replace(/\/$/, "");
  if (!fromEnv) {
    if (typeof window !== "undefined" && window.location?.hostname) {
      const port = String(process.env.REACT_APP_BACKEND_PORT || "8080").trim();
      const protocol = window.location.protocol || "http:";
      const hostname = window.location.hostname;
      return `${protocol}//${hostname}:${port}`;
    }
    return "";
  }

  if (typeof window !== "undefined" && window.location?.href) {
    // "//api.exemplo.com" — mesmo protocolo que a página (evita misto http/https no build)
    if (fromEnv.startsWith("//")) {
      try {
        return new URL(fromEnv, window.location.href).href.replace(/\/$/, "");
      } catch {
        return fromEnv;
      }
    }
    // Página HTTPS + API em http:// — alinha para https:// (a API tem de estar acessível em TLS)
    if (window.location.protocol === "https:" && /^http:\/\//i.test(fromEnv)) {
      try {
        const u = new URL(fromEnv);
        u.protocol = "https:";
        return u.href.replace(/\/$/, "");
      } catch {
        return fromEnv;
      }
    }
  }

  return fromEnv;
}

export function getBackendBaseURL() {
  return resolveBackendBaseURL();
}

/**
 * Monta URL absoluta da API (ex.: http://host:8080/ticket/kanban).
 */
export function getApiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = resolveBackendBaseURL();
  if (!base) return p;
  return `${base.replace(/\/$/, "")}${p}`;
}
