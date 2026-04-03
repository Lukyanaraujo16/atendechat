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
 * `path` deve começar com / (ex: "/ticket/kanban").
 * Evita bug em que, na rota React `/kanban`, paths relativos viram o próprio HTML do app.
 */
export function getApiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = getBackendBaseURL().replace(/\/$/, "");
  if (base) {
    return `${base}${p}`;
  }
  return p;
}
