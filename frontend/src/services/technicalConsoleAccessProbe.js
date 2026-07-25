import api from "../services/api";

/**
 * Probe compartilhado do Console Técnico.
 * Uma promise/resultado por userId em memória — sem polling, sem localStorage.
 *
 * Revogação: limpa no logout/troca de usuário; reload da página zera o módulo.
 * Deny-closed em erro de rede ou 403/401.
 */

let cacheUserId = null;
let cachePromise = null;
let cacheOutcome = null;

export function resetTechnicalConsoleAccessCache() {
  cacheUserId = null;
  cachePromise = null;
  cacheOutcome = null;
}

/**
 * @returns {Promise<{ state: "allowed"|"denied"|"error", payload?: object }>}
 */
export function probeTechnicalConsoleAccess(userId) {
  if (userId == null || userId === "") {
    return Promise.resolve({ state: "denied" });
  }

  const id = String(userId);

  if (cacheUserId === id && cacheOutcome) {
    return Promise.resolve(cacheOutcome);
  }

  if (cacheUserId === id && cachePromise) {
    return cachePromise;
  }

  cacheUserId = id;
  cacheOutcome = null;
  cachePromise = api
    .get("/technical-console/access")
    .then((res) => {
      const allowed = res?.data?.allowed === true;
      const outcome = allowed
        ? { state: "allowed", payload: res.data }
        : { state: "denied", payload: res.data };
      cacheOutcome = outcome;
      cachePromise = null;
      return outcome;
    })
    .catch((err) => {
      const status = err?.response?.status;
      const outcome =
        status === 403 || status === 401
          ? { state: "denied" }
          : { state: "error" };
      cacheOutcome = outcome;
      cachePromise = null;
      return outcome;
    });

  return cachePromise;
}
