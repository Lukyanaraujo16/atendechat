import sequelize from "../../database";
import AppError from "../../errors/AppError";
import PlatformEfiConfig from "../../models/PlatformEfiConfig";
import SaaSPayment from "../../models/SaaSPayment";
import SaaSSubscriptionRenewal from "../../models/SaaSSubscriptionRenewal";
import SaaSGatewayWebhookEvent from "../../models/SaaSGatewayWebhookEvent";
import { assertEfiSlotAllowedForRuntime } from "../../config/streamhubRuntimeEnv";
import { getAppBuildInfo } from "../../config/appBuildInfo";
import { recordEfiConfigAudit } from "./efiConfigAudit";
import { assertRuntimeReadyForEfiAdmin } from "./platformEfiConfigSerialize";
import { computeEfiConfigFingerprint } from "./efiConfigFingerprint";
import {
  evaluateEfiConfigReadiness,
  findEfiPixValidationForConfig
} from "./efiCredentialResolver";
import { invalidateEfiRuntimeCredentialsCache } from "./efiRuntimeCredentials";
import { getEfiPixChargeGateway } from "./efiPixChargeGateway";
import { getExpectedWebhookSecret } from "./webhookReception";
import { buildSubscriptionWebhookUrlV2 } from "./subscriptionWebhookUrl";
import { maskWebhookUrl } from "./efiPixAdminService";

/**
 * Registro de homologação (D-P17, RF1.7, R-14) — ação Super Admin com confirmação e auditoria
 * `homologate`, gravada para o `configFingerprint`, ambiente e commit atuais.
 *
 * - TESTE (`homologation`): exige a evidência do ciclo no slot — evento de webhook `applied`
 *   processado com a configuração atual (fonte `database`, mesmo fingerprint), o `SaaSPayment`
 *   gateway dele e a renovação desse pagamento.
 * - PRODUÇÃO (`production`): **sem pagamento real**. Exige referência ao relatório TESTE do
 *   mesmo commit, configuração válida, webhook conferido por GET no formato novo e evento
 *   `teste` persistido depois da ativação do slot (PT-7).
 * - Build sujo (`dirty`) ou sem commit é recusado (P-B31-11). Toda troca de segredo/P12 muda o
 *   fingerprint e invalida o registro (D-P2). Invalida o cache de credenciais (P-B31-05).
 */
export async function homologateEfiConfig(input: {
  slot: string;
  actorUserId: number;
  confirm: unknown;
  evidence: Record<string, unknown> | null | undefined;
}): Promise<Record<string, unknown>> {
  if (input.confirm !== true) {
    throw new AppError("ERR_EFI_HOMOLOGATE_CONFIRM_REQUIRED", 400, "Confirmação explícita obrigatória.");
  }
  const runtime = assertRuntimeReadyForEfiAdmin();
  if (input.slot !== runtime.slot) {
    throw new AppError(
      "ERR_EFI_SLOT_FORBIDDEN_FOR_RUNTIME",
      403,
      `Runtime atual permite apenas o slot '${runtime.slot}'.`
    );
  }
  const build = getAppBuildInfo();
  if (!build.commit) {
    throw new AppError("ERR_EFI_HOMOLOGATE_COMMIT_UNKNOWN", 400, "Versão (commit) da aplicação desconhecida.");
  }
  if (build.dirty === true) {
    throw new AppError(
      "ERR_EFI_HOMOLOGATE_DIRTY_BUILD",
      400,
      "Build com alterações não commitadas não pode ser homologado."
    );
  }
  const row = await PlatformEfiConfig.findOne({ where: { slot: runtime.slot } });
  if (!row) throw new AppError("ERR_EFI_CONFIG_NOT_FOUND", 404);
  assertEfiSlotAllowedForRuntime(row.slot, row.efiEnvironment);
  const fingerprint = computeEfiConfigFingerprint(row);
  const pixValidation = await findEfiPixValidationForConfig(row, fingerprint);
  const readiness = evaluateEfiConfigReadiness(row, { pixValidated: Boolean(pixValidation) });
  if (!readiness.validConfig) {
    throw new AppError(
      "ERR_EFI_CONFIG_NOT_VALID",
      400,
      `Configuração inválida para homologar: ${readiness.missing.join(", ")}.`
    );
  }

  const ev = input.evidence || {};
  const idOf = (k: string) => {
    const n = Number(ev[k]);
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  let evidence: Record<string, unknown>;

  if (runtime.slot === "homologation") {
    const eventId = idOf("webhookEventId");
    const paymentId = idOf("paymentId");
    const renewalId = idOf("renewalId");
    if (!eventId || !paymentId || !renewalId) {
      throw new AppError(
        "ERR_EFI_HOMOLOGATE_EVIDENCE_REQUIRED",
        400,
        "Informe o evento de webhook, o pagamento gateway e a renovação do ciclo homologado."
      );
    }
    const event = await SaaSGatewayWebhookEvent.findByPk(eventId);
    const result = (event?.result || {}) as Record<string, unknown>;
    if (
      !event ||
      event.eventType !== "pix" ||
      event.status !== "applied" ||
      event.paymentId !== paymentId ||
      result.currentSource !== "database" ||
      result.configFingerprint !== fingerprint ||
      result.efiEnvironment !== row.efiEnvironment
    ) {
      throw new AppError(
        "ERR_EFI_HOMOLOGATE_EVIDENCE_INVALID",
        400,
        "O evento informado não é um pagamento aplicado com a configuração atual deste slot."
      );
    }
    const payment = await SaaSPayment.findByPk(paymentId);
    const renewal = await SaaSSubscriptionRenewal.findByPk(renewalId);
    if (!payment || payment.source !== "gateway" || payment.externalTxid !== event.txid) {
      throw new AppError("ERR_EFI_HOMOLOGATE_EVIDENCE_INVALID", 400, "Pagamento gateway não corresponde ao evento.");
    }
    if (!renewal || renewal.paymentId !== payment.id) {
      throw new AppError("ERR_EFI_HOMOLOGATE_EVIDENCE_INVALID", 400, "Renovação não corresponde ao pagamento.");
    }
    evidence = { webhookEventId: event.id, paymentId: payment.id, renewalId: renewal.id };
  } else {
    const reportRef = typeof ev.testReportRef === "string" ? ev.testReportRef.trim().slice(0, 200) : "";
    const rawCommit = typeof ev.testReportCommit === "string" ? ev.testReportCommit.trim() : "";
    // SHA de 7 a 40 hex: prefixo curto casaria com qualquer build.
    const reportCommit = /^[0-9a-f]{7,40}$/i.test(rawCommit) ? rawCommit : "";
    const eventId = idOf("testEventId");
    if (!reportRef || !reportCommit || !eventId) {
      throw new AppError(
        "ERR_EFI_HOMOLOGATE_EVIDENCE_REQUIRED",
        400,
        "Informe o relatório TESTE aprovado (referência e commit) e o evento de teste persistido."
      );
    }
    const short = (c: string) => c.toLowerCase();
    if (!short(build.commit).startsWith(short(reportCommit)) && !short(reportCommit).startsWith(short(build.commit))) {
      throw new AppError(
        "ERR_EFI_HOMOLOGATE_COMMIT_MISMATCH",
        400,
        "O relatório TESTE é de outro commit."
      );
    }
    const event = await SaaSGatewayWebhookEvent.findByPk(eventId);
    if (
      !event ||
      event.eventType !== "teste" ||
      !row.activatedAt ||
      new Date(event.receivedAt).getTime() < new Date(row.activatedAt).getTime()
    ) {
      throw new AppError(
        "ERR_EFI_HOMOLOGATE_EVIDENCE_INVALID",
        400,
        "O evento informado não é uma notificação de teste recebida após a ativação do slot."
      );
    }
    // (c) webhook conferido por GET: a URL cadastrada é a do formato novo com o secret ativo.
    const gateway = await getEfiPixChargeGateway();
    const { secret } = await getExpectedWebhookSecret();
    const wh = await gateway.getWebhook(gateway.context.pixKey);
    if (!secret || !wh?.webhookUrl || wh.webhookUrl !== buildSubscriptionWebhookUrlV2(secret)) {
      throw new AppError(
        "ERR_EFI_HOMOLOGATE_WEBHOOK_NOT_CONFERRED",
        400,
        "O webhook cadastrado na Efí não confere com a URL esperada."
      );
    }
    evidence = {
      testReportRef: reportRef,
      testReportCommit: reportCommit,
      testEventId: event.id,
      webhookUrlMasked: maskWebhookUrl(wh.webhookUrl),
      webhookConferred: true
    };
  }

  const audit = await sequelize.transaction(async t => {
    // Revalida o fingerprint sob lock: troca de credencial no meio invalida a homologação.
    const locked = await PlatformEfiConfig.findByPk(row.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!locked || computeEfiConfigFingerprint(locked) !== fingerprint) {
      throw new AppError(
        "ERR_EFI_CONFIG_CHANGED_DURING_ACTIVATION",
        409,
        "A configuração mudou durante a homologação. Refaça."
      );
    }
    return recordEfiConfigAudit({
      configId: row.id,
      slot: row.slot,
      actorUserId: input.actorUserId,
      action: "homologate",
      transaction: t,
      diffSummary: {
        configFingerprint: fingerprint,
        efiEnvironment: row.efiEnvironment,
        commit: build.commit,
        commitSource: build.source,
        ...evidence
      }
    });
  });
  invalidateEfiRuntimeCredentialsCache();
  return {
    homologated: true,
    auditId: audit.id,
    slot: row.slot,
    efiEnvironment: row.efiEnvironment,
    configFingerprint: fingerprint,
    commit: build.commit,
    evidence
  };
}
