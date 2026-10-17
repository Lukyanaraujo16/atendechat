import sequelize from "../../database";
import AppError from "../../errors/AppError";
import { assertEfiEncryptionKeyConfigured, encryptEfiSecret, maskEfiSecret } from "../../helpers/efiCredentialCrypto";
import { assertEfiSlotAllowedForRuntime } from "../../config/streamhubRuntimeEnv";
import PlatformEfiConfig, {
  PlatformEfiConfigStatus,
  PlatformEfiSlot
} from "../../models/PlatformEfiConfig";
import PlatformEfiConfigAudit from "../../models/PlatformEfiConfigAudit";
import { recordEfiConfigAudit } from "./efiConfigAudit";
import {
  persistEfiCertificateEncrypted,
  revokeEfiCertificateRuntimeFile
} from "./efiCertificateStore";
import { testEfiCobrancasOAuthWithCredentials } from "./efiCobrancasOAuth";
import {
  assertRuntimeReadyForEfiAdmin,
  serializePlatformEfiConfig,
  PlatformEfiConfigPublicDto
} from "./platformEfiConfigSerialize";
import { decryptEfiSecret } from "../../helpers/efiCredentialCrypto";
import { assertEfiAuthTestRateLimit } from "./efiIntegrationStatus";

function hasEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("efic1:") && value.length > 10;
}

function assertSlotParam(
  slot: string,
  allowed: PlatformEfiSlot
): PlatformEfiSlot {
  if (slot !== "homologation" && slot !== "production") {
    throw new AppError("ERR_EFI_SLOT_INVALID", 400, "Slot inválido.");
  }
  if (slot !== allowed) {
    throw new AppError(
      "ERR_EFI_SLOT_FORBIDDEN_FOR_RUNTIME",
      403,
      `Runtime atual permite apenas o slot '${allowed}'.`
    );
  }
  return slot;
}

function recomputeStatus(row: PlatformEfiConfig): PlatformEfiConfigStatus {
  if (row.status === "revoked" && !hasEncrypted(row.clientIdEncrypted)) {
    return "revoked";
  }
  const hasIds =
    hasEncrypted(row.clientIdEncrypted) &&
    hasEncrypted(row.clientSecretEncrypted);
  if (!hasIds) {
    const anything =
      hasEncrypted(row.clientIdEncrypted) ||
      hasEncrypted(row.clientSecretEncrypted) ||
      hasEncrypted(row.certificateEncrypted) ||
      row.webhookSecretConfigured ||
      hasEncrypted(row.pixKeyEncrypted);
    return anything ? "incomplete" : "empty";
  }
  if (row.pixHomologated && row.adminEnabled) {
    return "operational";
  }
  if (row.lastAuthTestOk === true) {
    return "auth_validated";
  }
  return "configured";
}

async function getOrCreateRow(
  slot: PlatformEfiSlot,
  efiEnvironment: "sandbox" | "production",
  actorUserId: number | null
): Promise<PlatformEfiConfig> {
  let row = await PlatformEfiConfig.findOne({ where: { slot } });
  if (row) {
    assertEfiSlotAllowedForRuntime(row.slot, row.efiEnvironment);
    return row;
  }
  row = await PlatformEfiConfig.create({
    slot,
    efiEnvironment,
    status: "empty",
    webhookSecretConfigured: false,
    adminEnabled: false,
    pixHomologated: false,
    updatedByUserId: actorUserId
  });
  await recordEfiConfigAudit({
    configId: row.id,
    slot,
    actorUserId,
    action: "create",
    diffSummary: { created: true, efiEnvironment }
  });
  return row;
}

export async function getEfiAdminConfig(): Promise<PlatformEfiConfigPublicDto> {
  const runtime = assertRuntimeReadyForEfiAdmin();
  const row = await PlatformEfiConfig.findOne({
    where: { slot: runtime.slot }
  });
  return serializePlatformEfiConfig(row, { slot: runtime.slot });
}

/** GET tolerante quando runtime inválido — ainda retorna DTO com diagnosticState. */
export async function getEfiAdminConfigSafe(): Promise<PlatformEfiConfigPublicDto> {
  try {
    return await getEfiAdminConfig();
  } catch (err) {
    if (
      err instanceof AppError &&
      err.message === "ERR_STREAMHUB_RUNTIME_ENV_INVALID"
    ) {
      return serializePlatformEfiConfig(null);
    }
    throw err;
  }
}

export type UpsertEfiConfigBody = {
  clientId?: string | null;
  clientSecret?: string | null;
  pixKey?: string | null;
  webhookSecret?: string | null;
  cobrancasClientId?: string | null;
  cobrancasClientSecret?: string | null;
};

/**
 * Atualiza credenciais. Campos string vazios preservam o valor existente.
 * Não sobrescreve ciphertext com vazio.
 */
export async function upsertEfiAdminConfig(input: {
  slot: string;
  actorUserId: number;
  body: UpsertEfiConfigBody;
}): Promise<PlatformEfiConfigPublicDto> {
  assertEfiEncryptionKeyConfigured();
  const runtime = assertRuntimeReadyForEfiAdmin();
  const slot = assertSlotParam(input.slot, runtime.slot);

  const allowedKeys = new Set([
    "clientId",
    "clientSecret",
    "pixKey",
    "webhookSecret",
    "cobrancasClientId",
    "cobrancasClientSecret"
  ]);
  for (const key of Object.keys(input.body || {})) {
    if (!allowedKeys.has(key)) {
      throw new AppError(
        "ERR_EFI_CONFIG_UNKNOWN_FIELD",
        400,
        `Campo não permitido: ${key}`
      );
    }
  }

  const transaction = await sequelize.transaction();
  try {
    const row = await getOrCreateRow(
      slot,
      runtime.efiEnvironment,
      input.actorUserId
    );
    const locked = await PlatformEfiConfig.findByPk(row.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!locked) {
      throw new AppError("ERR_EFI_CONFIG_NOT_FOUND", 404);
    }

    const diff: Record<string, unknown> = {};
    const setSecret = (
      field: "clientId" | "clientSecret" | "pixKey" | "webhookSecret" | "cobrancasClientId" | "cobrancasClientSecret",
      encryptedField:
        | "clientIdEncrypted"
        | "clientSecretEncrypted"
        | "pixKeyEncrypted"
        | "webhookSecretEncrypted"
        | "cobrancasClientIdEncrypted"
        | "cobrancasClientSecretEncrypted",
      maskedField?:
        | "clientIdMasked"
        | "pixKeyMasked"
        | "cobrancasClientIdMasked"
    ) => {
      const raw = input.body[field];
      if (raw === undefined || raw === null) return;
      const trimmed = String(raw).trim();
      if (trimmed === "") return; // preservar existente
      locked[encryptedField] = encryptEfiSecret(trimmed) as never;
      if (maskedField) {
        locked[maskedField] = maskEfiSecret(trimmed) as never;
      }
      if (field === "webhookSecret") {
        locked.webhookSecretConfigured = true;
      }
      diff[`${field}Rotated`] = true;
    };

    setSecret("clientId", "clientIdEncrypted", "clientIdMasked");
    setSecret("clientSecret", "clientSecretEncrypted");
    setSecret("pixKey", "pixKeyEncrypted", "pixKeyMasked");
    setSecret("webhookSecret", "webhookSecretEncrypted");
    setSecret("cobrancasClientId", "cobrancasClientIdEncrypted", "cobrancasClientIdMasked");
    setSecret("cobrancasClientSecret", "cobrancasClientSecretEncrypted");

    // Nova gravação de secrets invalida auth anterior e admin enable
    if (Object.keys(diff).length > 0) {
      locked.lastAuthTestOk = null;
      locked.lastAuthTestAt = null;
      locked.lastAuthTestMessage = null;
      locked.adminEnabled = false;
      locked.activatedAt = null;
      locked.activatedByUserId = null;
      // pixHomologated nunca setado aqui
      if (locked.status === "revoked") {
        locked.status = "incomplete";
      }
      diff.authInvalidated = true;
      diff.adminDisabled = true;
    }

    locked.efiEnvironment = runtime.efiEnvironment;
    locked.updatedByUserId = input.actorUserId;
    locked.status = recomputeStatus(locked);
    await locked.save({ transaction });
    await transaction.commit();

    await recordEfiConfigAudit({
      configId: locked.id,
      slot,
      actorUserId: input.actorUserId,
      action: Object.keys(diff).some(k => k.endsWith("Rotated"))
        ? "rotate_secret"
        : "update_meta",
      diffSummary: diff
    });

    return serializePlatformEfiConfig(locked);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function uploadEfiCertificate(input: {
  slot: string;
  actorUserId: number;
  buffer: Buffer;
  originalName?: string;
}): Promise<PlatformEfiConfigPublicDto> {
  assertEfiEncryptionKeyConfigured();
  const runtime = assertRuntimeReadyForEfiAdmin();
  const slot = assertSlotParam(input.slot, runtime.slot);

  const name = String(input.originalName || "").toLowerCase();
  if (name && !name.endsWith(".p12") && !name.endsWith(".pfx")) {
    throw new AppError(
      "ERR_EFI_CERTIFICATE_INVALID_TYPE",
      400,
      "Extensão deve ser .p12 ou .pfx."
    );
  }

  // Valida e cifra ANTES de tocar no registro (evita perda se falhar)
  const persisted = persistEfiCertificateEncrypted(slot, input.buffer);

  const transaction = await sequelize.transaction();
  try {
    const row = await getOrCreateRow(
      slot,
      runtime.efiEnvironment,
      input.actorUserId
    );
    const locked = await PlatformEfiConfig.findByPk(row.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!locked) throw new AppError("ERR_EFI_CONFIG_NOT_FOUND", 404);

    const previousKey = locked.certificateStorageKey;
    locked.certificateEncrypted = persisted.encryptedPayload;
    locked.certificateStorageKey = persisted.storageKey;
    locked.certificateFingerprint = persisted.fingerprint;
    locked.certificateUploadedAt = new Date();
    locked.lastAuthTestOk = null;
    locked.lastAuthTestAt = null;
    locked.lastAuthTestMessage = null;
    locked.adminEnabled = false;
    locked.activatedAt = null;
    locked.activatedByUserId = null;
    locked.updatedByUserId = input.actorUserId;
    if (locked.status === "revoked") locked.status = "incomplete";
    locked.status = recomputeStatus(locked);
    await locked.save({ transaction });
    await transaction.commit();

    if (previousKey && previousKey !== persisted.storageKey) {
      revokeEfiCertificateRuntimeFile(previousKey);
    }

    await recordEfiConfigAudit({
      configId: locked.id,
      slot,
      actorUserId: input.actorUserId,
      action: "upload_cert",
      diffSummary: {
        fingerprint: persisted.fingerprint,
        authInvalidated: true,
        adminDisabled: true
      }
    });

    return serializePlatformEfiConfig(locked);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function deleteEfiCertificate(input: {
  slot: string;
  actorUserId: number;
}): Promise<PlatformEfiConfigPublicDto> {
  const runtime = assertRuntimeReadyForEfiAdmin();
  const slot = assertSlotParam(input.slot, runtime.slot);
  const row = await PlatformEfiConfig.findOne({ where: { slot } });
  if (!row) throw new AppError("ERR_EFI_CONFIG_NOT_FOUND", 404);

  const previousKey = row.certificateStorageKey;
  row.certificateEncrypted = null;
  row.certificateStorageKey = null;
  row.certificateFingerprint = null;
  row.certificateUploadedAt = null;
  row.adminEnabled = false;
  row.activatedAt = null;
  row.activatedByUserId = null;
  row.lastAuthTestOk = null;
  row.updatedByUserId = input.actorUserId;
  row.status = recomputeStatus(row);
  await row.save();
  revokeEfiCertificateRuntimeFile(previousKey);

  await recordEfiConfigAudit({
    configId: row.id,
    slot,
    actorUserId: input.actorUserId,
    action: "delete_cert",
    diffSummary: { certificateRevoked: true, adminDisabled: true }
  });

  return serializePlatformEfiConfig(row);
}

export async function testEfiAdminAuth(input: {
  slot: string;
  actorUserId: number;
}): Promise<{
  config: PlatformEfiConfigPublicDto;
  cobrancas: { ok: boolean; message: string; durationMs: number };
  pix: {
    available: false;
    tested: false;
    validated: false;
    message: string;
  };
}> {
  assertEfiEncryptionKeyConfigured();
  const runtime = assertRuntimeReadyForEfiAdmin();
  const slot = assertSlotParam(input.slot, runtime.slot);

  const limit = assertEfiAuthTestRateLimit(input.actorUserId);
  if (!limit.allowed) {
    throw new AppError(
      `Muitas tentativas de teste. Aguarde ${limit.retryAfterSec || 60}s.`,
      429
    );
  }

  const row = await PlatformEfiConfig.findOne({ where: { slot } });
  if (!row) throw new AppError("ERR_EFI_CONFIG_NOT_FOUND", 404);
  assertEfiSlotAllowedForRuntime(row.slot, row.efiEnvironment);

  if (
    !hasEncrypted(row.clientIdEncrypted) ||
    !hasEncrypted(row.clientSecretEncrypted)
  ) {
    throw new AppError(
      "ERR_EFI_CONFIG_INCOMPLETE",
      400,
      "Cadastre Client ID e Client Secret antes de testar."
    );
  }

  const clientId = decryptEfiSecret(row.clientIdEncrypted!);
  const clientSecret = decryptEfiSecret(row.clientSecretEncrypted!);
  // Prefer Cobranças dedicadas se existirem
  const cobId = hasEncrypted(row.cobrancasClientIdEncrypted)
    ? decryptEfiSecret(row.cobrancasClientIdEncrypted!)
    : clientId;
  const cobSecret = hasEncrypted(row.cobrancasClientSecretEncrypted)
    ? decryptEfiSecret(row.cobrancasClientSecretEncrypted!)
    : clientSecret;

  const cobrancas = await testEfiCobrancasOAuthWithCredentials({
    clientId: cobId,
    clientSecret: cobSecret,
    sandbox: row.efiEnvironment === "sandbox"
  });

  row.lastAuthTestAt = new Date();
  row.lastAuthTestOk = cobrancas.ok;
  row.lastAuthTestMessage = cobrancas.message.slice(0, 240);
  // OAuth NÃO marca Pix nem adminEnabled
  row.status = recomputeStatus(row);
  row.updatedByUserId = input.actorUserId;
  await row.save();

  await recordEfiConfigAudit({
    configId: row.id,
    slot,
    actorUserId: input.actorUserId,
    action: "test_auth",
    diffSummary: {
      cobrancasOk: cobrancas.ok,
      durationMs: cobrancas.durationMs,
      pixValidated: false
    }
  });

  return {
    config: serializePlatformEfiConfig(row),
    cobrancas,
    pix: {
      available: false,
      tested: false,
      validated: false,
      message:
        "Pix não validado: o SDK não oferece autenticação isolada sem cobrança. OAuth Cobranças ≠ Pix operacional."
    }
  };
}

export async function activateEfiAdminConfig(input: {
  slot: string;
  actorUserId: number;
  confirm: boolean;
}): Promise<PlatformEfiConfigPublicDto> {
  if (!input.confirm) {
    throw new AppError(
      "ERR_EFI_ACTIVATE_CONFIRM_REQUIRED",
      400,
      "Confirmação explícita obrigatória para ativar."
    );
  }
  const runtime = assertRuntimeReadyForEfiAdmin();
  const slot = assertSlotParam(input.slot, runtime.slot);
  const row = await PlatformEfiConfig.findOne({ where: { slot } });
  if (!row) throw new AppError("ERR_EFI_CONFIG_NOT_FOUND", 404);
  assertEfiSlotAllowedForRuntime(row.slot, row.efiEnvironment);

  if (
    !hasEncrypted(row.clientIdEncrypted) ||
    !hasEncrypted(row.clientSecretEncrypted)
  ) {
    throw new AppError(
      "ERR_EFI_CONFIG_INCOMPLETE",
      400,
      "Credenciais incompletas."
    );
  }
  if (!hasEncrypted(row.certificateEncrypted)) {
    throw new AppError(
      "ERR_EFI_CERTIFICATE_MISSING",
      400,
      "Certificado P12 obrigatório para ativação administrativa."
    );
  }
  if (row.lastAuthTestOk !== true) {
    throw new AppError(
      "ERR_EFI_AUTH_NOT_VALIDATED",
      400,
      "Execute o teste OAuth Cobranças com sucesso antes de ativar."
    );
  }

  row.adminEnabled = true;
  row.activatedAt = new Date();
  row.activatedByUserId = input.actorUserId;
  // pixHomologated permanece false — checkout legado inalterado
  row.status = recomputeStatus(row);
  row.updatedByUserId = input.actorUserId;
  await row.save();

  await recordEfiConfigAudit({
    configId: row.id,
    slot,
    actorUserId: input.actorUserId,
    action: "activate",
    diffSummary: {
      adminEnabled: true,
      pixHomologated: false,
      checkoutUnchanged: true
    }
  });

  return serializePlatformEfiConfig(row);
}

export async function deactivateEfiAdminConfig(input: {
  slot: string;
  actorUserId: number;
}): Promise<PlatformEfiConfigPublicDto> {
  const runtime = assertRuntimeReadyForEfiAdmin();
  const slot = assertSlotParam(input.slot, runtime.slot);
  const row = await PlatformEfiConfig.findOne({ where: { slot } });
  if (!row) throw new AppError("ERR_EFI_CONFIG_NOT_FOUND", 404);

  row.adminEnabled = false;
  row.activatedAt = null;
  row.activatedByUserId = null;
  row.status = recomputeStatus(row);
  row.updatedByUserId = input.actorUserId;
  await row.save();

  await recordEfiConfigAudit({
    configId: row.id,
    slot,
    actorUserId: input.actorUserId,
    action: "deactivate",
    diffSummary: { adminEnabled: false }
  });

  return serializePlatformEfiConfig(row);
}

export async function revokeEfiAdminConfig(input: {
  slot: string;
  actorUserId: number;
  confirm: boolean;
}): Promise<PlatformEfiConfigPublicDto> {
  if (!input.confirm) {
    throw new AppError(
      "ERR_EFI_REVOKE_CONFIRM_REQUIRED",
      400,
      "Confirmação explícita obrigatória para revogar."
    );
  }
  const runtime = assertRuntimeReadyForEfiAdmin();
  const slot = assertSlotParam(input.slot, runtime.slot);
  const row = await PlatformEfiConfig.findOne({ where: { slot } });
  if (!row) throw new AppError("ERR_EFI_CONFIG_NOT_FOUND", 404);

  const previousKey = row.certificateStorageKey;
  row.clientIdEncrypted = null;
  row.clientSecretEncrypted = null;
  row.clientIdMasked = null;
  row.pixKeyEncrypted = null;
  row.pixKeyMasked = null;
  row.webhookSecretEncrypted = null;
  row.webhookSecretConfigured = false;
  row.cobrancasClientIdEncrypted = null;
  row.cobrancasClientSecretEncrypted = null;
  row.cobrancasClientIdMasked = null;
  row.certificateEncrypted = null;
  row.certificateStorageKey = null;
  row.certificateFingerprint = null;
  row.certificateUploadedAt = null;
  row.lastAuthTestAt = null;
  row.lastAuthTestOk = null;
  row.lastAuthTestMessage = null;
  row.adminEnabled = false;
  row.pixHomologated = false;
  row.activatedAt = null;
  row.activatedByUserId = null;
  row.status = "revoked";
  row.updatedByUserId = input.actorUserId;
  await row.save();
  revokeEfiCertificateRuntimeFile(previousKey);

  await recordEfiConfigAudit({
    configId: row.id,
    slot,
    actorUserId: input.actorUserId,
    action: "revoke",
    diffSummary: { revoked: true }
  });

  return serializePlatformEfiConfig(row);
}

export async function listEfiAdminAudits(input: {
  limit?: number;
}): Promise<
  Array<{
    id: number;
    slot: string;
    action: string;
    actorUserId: number | null;
    diffSummary: Record<string, unknown> | null;
    createdAt: string;
  }>
> {
  const runtime = assertRuntimeReadyForEfiAdmin();
  const limit = Math.min(100, Math.max(1, Number(input.limit) || 50));
  const rows = await PlatformEfiConfigAudit.findAll({
    where: { slot: runtime.slot },
    order: [["createdAt", "DESC"]],
    limit
  });

  return rows.map(r => {
    let diff: Record<string, unknown> | null = null;
    if (r.diffSummary) {
      try {
        diff = JSON.parse(r.diffSummary);
      } catch {
        diff = null;
      }
    }
    return {
      id: r.id,
      slot: r.slot,
      action: r.action,
      actorUserId: r.actorUserId,
      diffSummary: diff,
      createdAt: r.createdAt.toISOString()
    };
  });
}
