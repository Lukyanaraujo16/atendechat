/**
 * Contrato de identidade OneSignal Web (Fase 2.13E).
 *
 * External ID = String(user.id) — o mesmo valor que o backend envia em
 * include_external_user_ids. Nunca companyId, e-mail, JWT ou subscription id.
 *
 * companyId / profile / queues são apenas tags (metadados).
 */

/**
 * Resolve o External ID individual do utilizador.
 * @param {object|null|undefined} user
 * @returns {string|null}
 */
export function resolveOneSignalExternalId(user) {
  if (user == null || typeof user !== "object") {
    return null;
  }
  // Preferir user.id (contrato backend include_external_user_ids).
  // Nunca usar companyId / company.id.
  const raw =
    user.id != null && user.id !== ""
      ? user.id
      : user.userId != null && user.userId !== ""
        ? user.userId
        : null;
  if (raw == null || raw === "") {
    return null;
  }
  const externalId = String(raw).trim();
  if (
    !externalId ||
    externalId === "undefined" ||
    externalId === "null" ||
    externalId === "[object Object]"
  ) {
    return null;
  }
  return externalId;
}

/**
 * companyId só para tags — nunca para login/external id.
 * @param {object|null|undefined} user
 * @returns {string}
 */
export function resolveOneSignalCompanyIdTag(user) {
  if (user == null || typeof user !== "object") {
    return "";
  }
  if (user.companyId != null && user.companyId !== "") {
    return String(user.companyId);
  }
  try {
    if (typeof localStorage !== "undefined") {
      const fromLs = localStorage.getItem("companyId");
      if (fromLs != null && fromLs !== "") {
        return String(fromLs);
      }
    }
  } catch {
    /* ignore */
  }
  return "";
}

/**
 * Filas estáveis e determinísticas para tag queue_ids.
 * @param {object|null|undefined} user
 * @returns {string}
 */
export function resolveOneSignalQueueIdsTag(user) {
  if (!Array.isArray(user?.queues) || user.queues.length === 0) {
    return "none";
  }
  const ids = user.queues
    .map((q) => (q != null && q.id != null ? String(q.id) : null))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "en"));
  return ids.length ? ids.join(",") : "none";
}

/**
 * Tags metadado — não definem identidade.
 * @param {object} user
 * @param {string} externalId
 * @returns {Record<string, string>}
 */
export function buildOneSignalIdentityTags(user, externalId) {
  const uid = externalId || resolveOneSignalExternalId(user) || "";
  return {
    user_id: String(uid),
    company_id: resolveOneSignalCompanyIdTag(user),
    profile: String(user?.profile || ""),
    queue_ids: resolveOneSignalQueueIdsTag(user),
  };
}

/**
 * Assinatura estável para deduplicar tags (ordem de chaves fixa).
 * @param {Record<string, string>} tags
 * @returns {string}
 */
export function oneSignalTagsSignature(tags = {}) {
  const keys = ["user_id", "company_id", "profile", "queue_ids"];
  return keys.map((k) => `${k}=${tags[k] != null ? String(tags[k]) : ""}`).join("|");
}

/**
 * Chave de single-flight: app + externalId + subscription (se houver).
 */
export function buildOneSignalIdentitySyncKey({
  appId,
  externalId,
  subscriptionId,
} = {}) {
  return [
    appId != null ? String(appId) : "",
    externalId != null ? String(externalId) : "",
    subscriptionId != null ? String(subscriptionId) : "",
  ].join(":");
}

/**
 * Guarda: login nunca deve usar companyId quando userId ≠ companyId.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function assertExternalIdIsNotCompanyId(externalId, companyIdTag) {
  if (externalId == null || externalId === "") {
    return { ok: false, reason: "missing_external_id" };
  }
  if (
    companyIdTag != null &&
    companyIdTag !== "" &&
    String(externalId) === String(companyIdTag)
  ) {
    // Pode ser legítimo (user.id === companyId, ex.: user 1 / company 1).
    // Apenas sinaliza ambiguidade — não bloqueia.
    return { ok: true, reason: "external_id_equals_company_id_ambiguous" };
  }
  return { ok: true };
}

/**
 * SupportMode: External ID continua a ser o utilizador autenticado da sessão
 * (ex.: Super Admin), nunca o companyId do tenant visitado.
 */
export function describeOneSignalSupportModeIdentity(user) {
  const externalId = resolveOneSignalExternalId(user);
  const companyIdTag = resolveOneSignalCompanyIdTag(user);
  return {
    supportMode: Boolean(user?.supportMode === true),
    sessionUserExternalId: externalId,
    selectedCompanyIdTag: companyIdTag,
    usesTenantCompanyIdAsExternalId: false,
    note:
      "Push associa-se ao utilizador autenticado da sessão; companyId do tenant é só tag.",
  };
}
