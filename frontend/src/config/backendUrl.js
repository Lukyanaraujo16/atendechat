/**
 * URL base do Express (REST + /public + Socket.io).
 *
 * 1) REACT_APP_BACKEND_URL no .env (build) — URL completa, se definida.
 * 2) Se vazio: no navegador, usa o mesmo protocolo/host da página + REACT_APP_BACKEND_PORT (padrão 8080).
 *    Evita o erro em que o axios ia para o Nginx e recebia index.html ("You need to enable JavaScript...").
 */
export function getBackendBaseURL() {
  const fromEnv = (process.env.REACT_APP_BACKEND_URL || "").trim();
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined" && window.location && window.location.hostname) {
    const port = String(process.env.REACT_APP_BACKEND_PORT || "8080").trim();
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${port}`;
  }

  return "";
}

/**
 * Monta URL absoluta da API (ex.: http://host:8080/ticket/kanban).
 * No navegador **nunca** devolve só "/ticket/..." — sempre host + porta do backend,
 * senão o axios pode resolver contra a rota atual `/kanban` e pedir HTML do SPA.
 */
export function getApiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  let base = getBackendBaseURL().replace(/\/$/, "");
  if (!base && typeof window !== "undefined" && window.location?.hostname) {
    const port = String(process.env.REACT_APP_BACKEND_PORT || "8080").trim();
    const { protocol, hostname } = window.location;
    base = `${protocol}//${hostname}:${port}`;
  }
  if (!base) {
    return p;
  }
  return `${base}${p}`;
}
