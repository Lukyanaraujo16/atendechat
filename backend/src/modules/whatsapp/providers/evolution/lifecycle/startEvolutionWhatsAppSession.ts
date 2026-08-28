import * as Sentry from "@sentry/node";
import AppError from "../../../../../errors/AppError";
import Whatsapp from "../../../../../models/Whatsapp";
import { logger } from "../../../../../utils/logger";
import {
  EvolutionHttpError,
  evolutionConnect,
  evolutionConnectionState
} from "../inbound/evolutionHttpClient";
import { applyEvolutionSessionStatus } from "./applyEvolutionSessionStatus";
import { ensureEvolutionInstance } from "./ensureEvolutionInstance";
import {
  extractEvolutionQrcodeRaw,
  extractEvolutionStateFromPayload,
  mapEvolutionStateToStreamHubStatus
} from "./mapEvolutionConnectionState";

/**
 * Lifecycle real Evolution (Fase 10).
 * Nunca chama initWASocket / Get*Wbot / Baileys.
 */
export async function startEvolutionWhatsAppSession(
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> {
  if (Number(whatsapp.companyId) !== Number(companyId)) {
    throw new AppError("ERR_FORBIDDEN", 403);
  }

  try {
    await applyEvolutionSessionStatus({
      whatsapp,
      status: "OPENING",
      qrcode: "",
      force: true
    });

    await ensureEvolutionInstance(whatsapp.id);

    const statePayload = await evolutionConnectionState({
      whatsappId: whatsapp.id
    });
    const state = extractEvolutionStateFromPayload(statePayload);

    if (state === "open") {
      await applyEvolutionSessionStatus({
        whatsapp,
        status: "CONNECTED",
        qrcode: "",
        retries: 0,
        force: true
      });
      logger.info(
        {
          whatsappId: whatsapp.id,
          companyId,
          operation: "start",
          status: "CONNECTED"
        },
        "[EvolutionLifecycle] already connected — restored"
      );
      return;
    }

    const connectPayload = await evolutionConnect({
      whatsappId: whatsapp.id
    });
    const connectState = extractEvolutionStateFromPayload(connectPayload);
    if (connectState === "open") {
      await applyEvolutionSessionStatus({
        whatsapp,
        status: "CONNECTED",
        qrcode: "",
        retries: 0,
        force: true
      });
      return;
    }

    const qrRaw = extractEvolutionQrcodeRaw(connectPayload);
    if (qrRaw) {
      await applyEvolutionSessionStatus({
        whatsapp,
        status: "qrcode",
        qrcode: qrRaw,
        force: true
      });
      return;
    }

    const mapped = mapEvolutionStateToStreamHubStatus(
      connectState !== "unknown" ? connectState : state
    );
    await applyEvolutionSessionStatus({
      whatsapp,
      status: mapped === "CONNECTED" ? "OPENING" : mapped,
      qrcode: "",
      force: true
    });
  } catch (err) {
    Sentry.captureException(err);
    logger.warn(
      {
        err,
        whatsappId: whatsapp.id,
        companyId,
        operation: "start",
        code: err instanceof EvolutionHttpError ? err.code : undefined
      },
      "[EvolutionLifecycle] start failed"
    );
    try {
      await applyEvolutionSessionStatus({
        whatsapp,
        status: "DISCONNECTED",
        qrcode: "",
        force: true
      });
    } catch {
      // ignore secondary
    }
    // StartAll / boot: não propaga — isolamento de falhas.
  }
}

/**
 * Restart / “Tentar novamente” / “Novo QR”:
 * reinicia sessão Evolution via start (ensure + connect).
 */
export async function restartEvolutionWhatsAppSession(
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> {
  await startEvolutionWhatsAppSession(whatsapp, companyId);
}
