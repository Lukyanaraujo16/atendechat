/**
 * Métricas controladas da experiência PWA (sem dados sensíveis).
 * Em produção: um log estruturado mínimo; em desenvolvimento: console.info.
 */

const ALLOWED_EVENTS = new Set([
  "install_prompt_available",
  "install_prompt_shown",
  "install_prompt_accepted",
  "install_prompt_dismissed",
  "ios_instructions_shown",
  "standalone_detected",
  "push_activation_requested",
  "push_activation_success",
  "push_activation_failed",
]);

export function logPwaInstallMetric(event, payload = {}) {
  if (!ALLOWED_EVENTS.has(event)) return;

  const safe = {};
  Object.keys(payload || {}).forEach((key) => {
    if (/token|password|email|authorization|secret/i.test(key)) return;
    const value = payload[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    }
  });

  const entry = {
    event,
    at: new Date().toISOString(),
    ...safe,
  };

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.info("[pwa_install_metrics]", entry);
  } else if (process.env.NODE_ENV === "test") {
    // silencioso nos testes
  } else {
    // eslint-disable-next-line no-console
    console.log("[pwa_install_metrics]", JSON.stringify(entry));
  }
}
