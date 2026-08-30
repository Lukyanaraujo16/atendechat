/**
 * UI Fase 11 — Evolution central / Super Admin.
 * Super Admin canônico: user.super === true (mesmo significado de OnlyForSuperUser).
 * Não confundir com provider legado Baileys ("beta").
 */

export function isPlatformSuperAdmin(user) {
  return user?.super === true;
}

export const CONNECTION_PROVIDER_STANDARD = "baileys";
export const CONNECTION_PROVIDER_EVOLUTION = "evolution";

/**
 * Monta payload de create/edit sem secrets Evolution e sem misturar provider legado.
 * connectionProvider só no CREATE e só para Super Admin.
 */
export function buildWhatsAppMutationPayload({
  values,
  queueIds,
  transferQueueId,
  promptId,
  integrationId,
  flowIdWelcome,
  flowIdNotPhrase,
  isCreate,
  isSuperAdmin,
}) {
  const whatsappData = {
    ...values,
    queueIds,
    transferQueueId,
    promptId,
    integrationId,
    flowIdWelcome,
    flowIdNotPhrase,
  };

  delete whatsappData.aiAgentId;
  delete whatsappData.aiAgentMode;
  delete whatsappData.aiAgentEnabled;
  delete whatsappData.queues;
  delete whatsappData.session;
  delete whatsappData.evolution;
  delete whatsappData.baseUrl;
  delete whatsappData.apiKey;
  delete whatsappData.instanceName;
  delete whatsappData.instanceId;
  delete whatsappData.apiKeyMasked;
  delete whatsappData.apiKeyEncrypted;

  if (isCreate) {
    delete whatsappData.token;
    if (isSuperAdmin) {
      const selected =
        whatsappData.connectionProvider === CONNECTION_PROVIDER_EVOLUTION
          ? CONNECTION_PROVIDER_EVOLUTION
          : CONNECTION_PROVIDER_STANDARD;
      whatsappData.connectionProvider = selected;
    } else {
      delete whatsappData.connectionProvider;
    }
  } else {
    // Provider imutável — nunca enviar no edit.
    delete whatsappData.connectionProvider;
  }

  return whatsappData;
}

/**
 * Fecha QR apenas com status CONNECTED (não com qrcode vazio sozinho).
 */
export function shouldCloseQrcodeModalOnSession(session) {
  if (!session || typeof session !== "object") return false;
  return session.status === "CONNECTED";
}

/**
 * Label de produto para badge (chave i18n relativa a connections.providerBadge.*).
 */
export function connectionProviderBadgeKey(connectionProvider) {
  if (connectionProvider === CONNECTION_PROVIDER_EVOLUTION) {
    return "evolution";
  }
  return "standard";
}

/**
 * Ações de sessão/mutação na lista Connections (desktop e mobile).
 * Sem canManageConnections → nenhuma ação.
 */
export function listConnectionActionKeys({ status, canManageConnections }) {
  if (!canManageConnections) {
    return [];
  }
  const keys = [];
  if (status === "qrcode") {
    keys.push("qrcode");
  }
  if (status === "DISCONNECTED" || status === "PENDING") {
    keys.push("tryAgain", "newQr");
  }
  if (
    status === "CONNECTED" ||
    status === "PAIRING" ||
    status === "TIMEOUT"
  ) {
    keys.push("disconnect");
  }
  keys.push("edit", "delete");
  return keys;
}
