import crypto from "crypto";
import AppError from "../errors/AppError";
import {
  decodeBase64UrlToBuffer,
  decodeBase64UrlToUtf8,
  encodeBase64Url
} from "./base64Url";
import {
  getMissingMetaOAuthStateKeys,
  logMetaOAuthConfigCheck,
  logMetaOAuthConfigMissing
} from "./metaOAuthConfigCheck";
import { logger } from "../utils/logger";

export interface MetaOAuthStatePayload {
  companyId: number;
  instagramAccountId: number;
  userId: string;
  nonce: string;
  exp: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;
const STATE_SEPARATOR = ".";

type StateDebugCallback = {
  stateLength: number;
  hasDot: boolean;
  partsCount: number;
  receivedStatePreview: string;
  signatureLength: number;
  payloadDecodeOk: boolean;
  exp: number | null;
  now: number;
  expired: boolean;
  verifyResult: string;
};

const getStateSecret = (): string => {
  const configFlags = logMetaOAuthConfigCheck("metaOAuthState", {
    phase: "state_sign"
  });
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) {
    logMetaOAuthConfigMissing(
      "metaOAuthState",
      getMissingMetaOAuthStateKeys(configFlags)
    );
    throw new AppError(
      "ERR_META_APP_CONFIG_MISSING",
      500,
      "Configuração Meta incompleta no servidor."
    );
  }
  return secret;
};

const signPayloadBase64 = (payloadB64: string): string =>
  crypto
    .createHmac("sha256", getStateSecret())
    .update(payloadB64, "utf8")
    .digest("base64url");

const verifySignature = (payloadB64: string, signatureB64: string): boolean => {
  const expectedSignatureB64 = signPayloadBase64(payloadB64);

  try {
    const received = decodeBase64UrlToBuffer(signatureB64);
    const expected = decodeBase64UrlToBuffer(expectedSignatureB64);

    if (received.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(received, expected);
  } catch {
    return false;
  }
};

/**
 * Normaliza o parâmetro state recebido na query string.
 * - trim
 * - remove fragmento (#_ do Instagram não chega ao servidor, mas protege edge cases)
 * - decodeURIComponent apenas se ainda houver percent-encoding
 */
export const normalizeOAuthStateParam = (raw: string | undefined): string => {
  if (!raw) {
    return "";
  }

  let state = raw.trim();

  const hashIndex = state.indexOf("#");
  if (hashIndex >= 0) {
    state = state.slice(0, hashIndex);
  }

  if (state.includes("%")) {
    try {
      state = decodeURIComponent(state);
    } catch {
      // mantém valor original
    }
  }

  return state.trim();
};

const buildStatePreview = (state: string): string => {
  if (!state) return "";
  return state.length <= 8 ? state : `${state.slice(0, 8)}…`;
};

const analyzeStateStructure = (state: string) => ({
  stateLength: state.length,
  hasDot: state.includes(STATE_SEPARATOR),
  partsCount: state ? state.split(STATE_SEPARATOR).length : 0
});

const logStateDebugStart = (state: string, exp: number): void => {
  const now = Date.now();
  logger.info(
    {
      ...analyzeStateStructure(state),
      exp,
      now
    },
    "[InstagramOAuth] state_debug_start"
  );
};

const logStateDebugCallback = (debug: StateDebugCallback): void => {
  logger.info(debug, "[InstagramOAuth] state_debug_callback");
};

const throwInvalidState = (debug: StateDebugCallback): never => {
  logStateDebugCallback(debug);
  throw new AppError(
    "ERR_META_OAUTH_STATE_INVALID",
    400,
    "Não foi possível validar o retorno da Meta."
  );
};

const throwExpiredState = (debug: StateDebugCallback): never => {
  logStateDebugCallback(debug);
  throw new AppError(
    "ERR_META_OAUTH_STATE_EXPIRED",
    400,
    "OAuth expirado. Tente conectar novamente."
  );
};

export const createMetaOAuthState = (
  payload: Pick<MetaOAuthStatePayload, "companyId" | "instagramAccountId" | "userId">
): string => {
  const full: MetaOAuthStatePayload = {
    ...payload,
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + STATE_TTL_MS
  };

  const payloadB64 = encodeBase64Url(JSON.stringify(full));
  const signatureB64 = signPayloadBase64(payloadB64);
  const state = `${payloadB64}${STATE_SEPARATOR}${signatureB64}`;

  logStateDebugStart(state, full.exp);

  return state;
};

export const verifyMetaOAuthState = (state: string): MetaOAuthStatePayload => {
  const now = Date.now();
  const normalized = normalizeOAuthStateParam(state);
  const parts = normalized.split(STATE_SEPARATOR);

  const debug: StateDebugCallback = {
    ...analyzeStateStructure(normalized),
    receivedStatePreview: buildStatePreview(normalized),
    signatureLength: 0,
    payloadDecodeOk: false,
    exp: null,
    now,
    expired: false,
    verifyResult: "invalid"
  };

  if (!normalized) {
    debug.verifyResult = "empty";
    return throwInvalidState(debug);
  }

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    debug.verifyResult = "invalid_format";
    return throwInvalidState(debug);
  }

  const [payloadB64, signatureB64] = parts;
  debug.signatureLength = signatureB64.length;

  let payloadJson: string;
  try {
    payloadJson = decodeBase64UrlToUtf8(payloadB64);
    debug.payloadDecodeOk = true;
  } catch {
    debug.verifyResult = "payload_decode_failed";
    return throwInvalidState(debug);
  }

  if (!verifySignature(payloadB64, signatureB64)) {
    debug.verifyResult = "signature_mismatch";
    return throwInvalidState(debug);
  }

  let payload: MetaOAuthStatePayload;
  try {
    payload = JSON.parse(payloadJson) as MetaOAuthStatePayload;
  } catch {
    debug.verifyResult = "json_parse_failed";
    return throwInvalidState(debug);
  }

  if (
    typeof payload.companyId !== "number" ||
    typeof payload.instagramAccountId !== "number" ||
    typeof payload.userId !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.exp !== "number"
  ) {
    debug.verifyResult = "invalid_payload_shape";
    return throwInvalidState(debug);
  }

  debug.exp = payload.exp;
  debug.expired = now > payload.exp;

  if (debug.expired) {
    debug.verifyResult = "expired";
    return throwExpiredState(debug);
  }

  debug.verifyResult = "ok";
  logStateDebugCallback(debug);

  return payload;
};
