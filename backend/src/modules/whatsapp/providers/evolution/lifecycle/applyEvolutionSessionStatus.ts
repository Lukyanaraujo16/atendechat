import { getIO } from "../../../../../libs/socket";
import Whatsapp from "../../../../../models/Whatsapp";
import { logger } from "../../../../../utils/logger";
import {
  shouldApplyStreamHubStatus,
  StreamHubWhatsappStatus
} from "./mapEvolutionConnectionState";

export function emitWhatsappSessionUpdate(whatsapp: Whatsapp): void {
  const io = getIO();
  io.to(`company-${whatsapp.companyId}-mainchannel`).emit(
    `company-${whatsapp.companyId}-whatsappSession`,
    {
      action: "update",
      session: whatsapp
    }
  );
}

export type ApplyEvolutionSessionResult = {
  applied: boolean;
  reason?: string;
  status: string;
  qrcode?: string;
};

/**
 * Atualiza Whatsapp.status/qrcode + Socket.IO (contrato frontend).
 * Não inclui secrets. qrcode = string bruta ou "".
 */
export async function applyEvolutionSessionStatus(input: {
  whatsapp: Whatsapp;
  status: StreamHubWhatsappStatus;
  qrcode?: string | null;
  retries?: number;
  force?: boolean;
}): Promise<ApplyEvolutionSessionResult> {
  const { whatsapp } = input;
  const nextQr =
    input.qrcode === undefined || input.qrcode === null
      ? whatsapp.qrcode || ""
      : String(input.qrcode);
  const nextStatus = input.status;

  const statusSame = String(whatsapp.status || "") === nextStatus;
  const qrSame = String(whatsapp.qrcode || "") === nextQr;

  if (!input.force && statusSame && qrSame) {
    return { applied: false, reason: "noop_same", status: nextStatus };
  }

  if (
    !input.force &&
    !statusSame &&
    !shouldApplyStreamHubStatus({
      current: whatsapp.status,
      next: nextStatus
    })
  ) {
    // Ainda permite atualizar QR se status atual é qrcode/OPENING e next também
    if (!(statusSame === false && nextStatus === "qrcode" && !qrSame)) {
      logger.info(
        {
          whatsappId: whatsapp.id,
          companyId: whatsapp.companyId,
          current: whatsapp.status,
          next: nextStatus
        },
        "[EvolutionLifecycle] status update skipped (ordering)"
      );
      return {
        applied: false,
        reason: "ordering_skip",
        status: String(whatsapp.status || "")
      };
    }
  }

  const patch: {
    status: StreamHubWhatsappStatus;
    qrcode: string;
    retries?: number;
  } = {
    status: nextStatus,
    qrcode: nextStatus === "CONNECTED" ? "" : nextQr
  };
  if (input.retries != null) {
    patch.retries = input.retries;
  } else if (nextStatus === "CONNECTED") {
    patch.retries = 0;
    patch.qrcode = "";
  }

  await whatsapp.update(patch);
  emitWhatsappSessionUpdate(whatsapp);

  logger.info(
    {
      whatsappId: whatsapp.id,
      companyId: whatsapp.companyId,
      status: patch.status,
      hasQrcode: Boolean(patch.qrcode)
    },
    "[EvolutionLifecycle] session status applied"
  );

  return {
    applied: true,
    status: patch.status,
    qrcode: patch.qrcode
  };
}
