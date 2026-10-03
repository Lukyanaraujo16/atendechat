/**
 * Contrato de identidade OneSignal Web.
 *
 * External ID de login = streamhub_user_<User.id>.
 * O backend continua enviando o par legado + namespaced.
 * Nunca companyId, e-mail, JWT ou subscription id.
 *
 * companyId / profile / queues são apenas tags (metadados).
 * A tag user_id permanece o id interno do StreamHub, não o External ID.
 */

const ONESIGNAL_EXTERNAL_ID_PREFIX = "streamhub_user_";

/**
 * Id interno aceito pelo contrato atual: user.id, senão user.userId.
 * @param {object|null|undefined} user
 * @returns {string|null}
 */
function resolveStreamHubUserId(user) {
  if (user == null || typeof user !== "object") {
    return null;
  }
  const raw =
    user.id != null && user.id !== ""
      ? user.id
      : user.userId != null && user.userId !== ""
        ? user.userId
        : null;
  if (raw == null || raw === "") {
    return null;
  }
  const userId = String(raw).trim();
  if (
    !userId ||
    userId === "undefined" ||
    userId === "null" ||
    userId === "[object Object]"
  ) {
    return null;
  }
  return userId;
}

/**
 * Resolve o External ID individual do utilizador.
 * @param {object|null|undefined} user
 * @returns {string|null}
 */
export function resolveOneSignalExternalId(user) {
  const userId = resolveStreamHubUserId(user);
  if (!userId) {
    return null;
  }
  return `${ONESIGNAL_EXTERNAL_ID_PREFIX}${userId}`;
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
 * user_id é o id interno do StreamHub. O argumento externalId é o alias de
 * login e não é copiado para a tag.
 * @param {object} user
 * @param {string} [_externalId]
 * @returns {Record<string, string>}
 */
export function buildOneSignalIdentityTags(user, _externalId) {
  const uid = resolveStreamHubUserId(user) || "";
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

const LOCAL_ONESIGNAL_ID_PREFIX = "local-";

/**
 * OneSignal ID remoto: string não vazia que não é o placeholder local-* do SDK.
 * null/undefined (o getter público esconde local-*) não conta.
 */
export function isRemoteOnesignalUserId(onesignalId) {
  if (typeof onesignalId !== "string") return false;
  const id = onesignalId.trim();
  return Boolean(id) && !id.startsWith(LOCAL_ONESIGNAL_ID_PREFIX);
}

/**
 * Confirmação remota: External ID esperado E OneSignal ID remoto.
 * Promise de login resolvida, sozinha, não basta.
 */
export function isRemoteOneSignalIdentityConfirmed(snapshot, expectedExternalId) {
  if (typeof expectedExternalId !== "string" || !expectedExternalId) {
    return false;
  }
  if (!snapshot || snapshot.externalId !== expectedExternalId) {
    return false;
  }
  return isRemoteOnesignalUserId(snapshot.onesignalId);
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
