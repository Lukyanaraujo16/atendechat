/**
 * Evolution connection state → StreamHub Whatsapp.status
 *
 * | Evolution   | StreamHub      |
 * |-------------|----------------|
 * | open        | CONNECTED      |
 * | connecting  | OPENING        |
 * | close       | DISCONNECTED   |
 * | refused     | DISCONNECTED   |
 * | unknown     | DISCONNECTED   |
 *
 * Quando há QR textual disponível e ainda não connected → status `qrcode`.
 */

export type EvolutionConnectionState =
  | "open"
  | "connecting"
  | "close"
  | "refused"
  | "unknown";

export type StreamHubWhatsappStatus =
  | "CONNECTED"
  | "OPENING"
  | "qrcode"
  | "DISCONNECTED"
  | "PENDING";

const STATE_ALIASES: Record<string, EvolutionConnectionState> = {
  open: "open",
  opened: "open",
  connected: "open",
  connecting: "connecting",
  close: "close",
  closed: "close",
  disconnected: "close",
  logout: "close",
  refused: "refused",
  unknown: "unknown"
};

export function normalizeEvolutionConnectionState(
  raw: unknown
): EvolutionConnectionState {
  if (raw == null) return "unknown";
  const key = String(raw).trim().toLowerCase();
  return STATE_ALIASES[key] || "unknown";
}

export function mapEvolutionStateToStreamHubStatus(
  state: EvolutionConnectionState,
  options?: { hasQrcode?: boolean }
): StreamHubWhatsappStatus {
  if (state === "open") return "CONNECTED";
  if (state === "connecting") {
    return options?.hasQrcode ? "qrcode" : "OPENING";
  }
  if (state === "refused") return "DISCONNECTED";
  return "DISCONNECTED";
}

/**
 * Prioridade para evitar regressões óbvias (QR após CONNECTED).
 * DISCONNECT a partir de CONNECTED é permitido.
 */
export function streamHubStatusRank(status: string | null | undefined): number {
  const s = String(status || "").trim();
  if (s === "CONNECTED") return 40;
  if (s === "qrcode") return 30;
  if (s === "OPENING" || s === "PAIRING") return 20;
  if (s === "PENDING" || s === "TIMEOUT") return 10;
  if (s === "DISCONNECTED") return 5;
  return 0;
}

/**
 * Decide se o novo status deve sobrescrever o atual.
 * - CONNECTED sempre aplica
 * - DISCONNECTED/PENDING a partir de CONNECTED aplica (logout real)
 * - QR/OPENING NÃO regride CONNECTED
 * - Mesmo status: noop (exceto atualização de QR string — tratada fora)
 */
export function shouldApplyStreamHubStatus(input: {
  current: string | null | undefined;
  next: StreamHubWhatsappStatus;
}): boolean {
  const current = String(input.current || "").trim();
  const { next } = input;
  if (!current) return true;
  if (current === next) return false;
  if (next === "CONNECTED") return true;
  if (current === "CONNECTED") {
    return next === "DISCONNECTED" || next === "PENDING";
  }
  return streamHubStatusRank(next) >= streamHubStatusRank(current);
}

/** Extrai state de respostas connectionState / connect / webhook. */
export function extractEvolutionStateFromPayload(
  data: unknown
): EvolutionConnectionState {
  if (!data || typeof data !== "object") return "unknown";
  const root = data as Record<string, unknown>;
  if (root.state != null) return normalizeEvolutionConnectionState(root.state);
  if (root.status != null)
    return normalizeEvolutionConnectionState(root.status);
  const { instance } = root;
  if (instance && typeof instance === "object") {
    const inst = instance as Record<string, unknown>;
    if (inst.state != null)
      return normalizeEvolutionConnectionState(inst.state);
    if (inst.status != null)
      return normalizeEvolutionConnectionState(inst.status);
  }
  const nested = root.data;
  if (nested && typeof nested === "object") {
    return extractEvolutionStateFromPayload(nested);
  }
  return "unknown";
}

/**
 * Extrai string bruta do QR (campo `code`) para QrcodeModal / qrcode.react.
 * NÃO usa base64/data-URL (frontend gera o QR a partir do texto).
 */
export function extractEvolutionQrcodeRaw(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;

  const tryCode = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (!t) return null;
    if (t.startsWith("data:image")) return null;
    return t;
  };

  const direct = tryCode(root.code);
  if (direct) return direct;

  const { qrcode } = root;
  if (qrcode && typeof qrcode === "object") {
    const q = qrcode as Record<string, unknown>;
    const fromQr = tryCode(q.code);
    if (fromQr) return fromQr;
  }

  const { instance } = root;
  if (instance && typeof instance === "object") {
    const inst = instance as Record<string, unknown>;
    const fromInst = extractEvolutionQrcodeRaw(inst);
    if (fromInst) return fromInst;
    if (inst.qrCode && typeof inst.qrCode === "object") {
      const fromNested = extractEvolutionQrcodeRaw(inst.qrCode);
      if (fromNested) return fromNested;
    }
  }

  const nested = root.data;
  if (nested && typeof nested === "object") {
    return extractEvolutionQrcodeRaw(nested);
  }

  return null;
}
