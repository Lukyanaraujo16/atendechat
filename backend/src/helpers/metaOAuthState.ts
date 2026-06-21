import crypto from "crypto";
import AppError from "../errors/AppError";
import {
  base64UrlDecodeToString,
  base64UrlEncode
} from "./base64Url";
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

type StateDebugLog = {
  stateLength: number;
  partsCount: number;
  hasDot: boolean;
  payloadDecodeOk: boolean;
  signatureLength?: number;
  exp: number | null;
  now: number;
  expired?: boolean;
  verifyResult: string;
  failReason?: string;
};

const readMetaAppSecret = (): string => {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) {
    throw new AppError(
      "ERR_META_APP_CONFIG_MISSING",
      500,
      "Configuração Meta incompleta no servidor."
    );
  }
  return secret;
};

const signPayloadBase64 = (payloadB64: string, secret: string): string =>
  crypto.createHmac("sha256", secret).update(payloadB64, "utf8").digest("base64url");

const timingSafeEqualString = (left: string, right: string): boolean => {
  const leftBuf = Buffer.from(left, "utf8");
  const rightBuf = Buffer.from(right, "utf8");

  if (leftBuf.length !== rightBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuf, rightBuf);
};

const analyzeStateStructure = (state: string) => ({
  stateLength: state.length,
  hasDot: state.includes(STATE_SEPARATOR),
  partsCount: state ? state.split(STATE_SEPARATOR).length : 0
});

const splitStateParts = (
  state: string
): { payloadB64: string; signatureB64: string } | null => {
  const dotIndex = state.indexOf(STATE_SEPARATOR);
  if (dotIndex <= 0 || dotIndex >= state.length - 1) {
    return null;
  }

  return {
    payloadB64: state.slice(0, dotIndex),
    signatureB64: state.slice(dotIndex + 1)
  };
};

/**
 * Normaliza state recebido na query string.
 * Express já faz URL-decode; não aplicar decodeURIComponent no state inteiro.
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

  return state.trim();
};

const logStateDebugStart = (
  state: string,
  exp: number,
  payloadDecodeOk: boolean
): void => {
  logger.info(
    {
      ...analyzeStateStructure(state),
      payloadDecodeOk,
      exp,
      now: Date.now()
    },
    "[InstagramOAuth] state_debug_start"
  );
};

const logStateDebugCallback = (debug: StateDebugLog): void => {
  logger.info(debug, "[InstagramOAuth] state_debug_callback");
};

const failStateValidation = (
  debug: StateDebugLog,
  errorCode: "ERR_META_OAUTH_STATE_INVALID" | "ERR_META_OAUTH_STATE_EXPIRED"
): never => {
  logStateDebugCallback(debug);
  throw new AppError(
    errorCode,
    400,
    errorCode === "ERR_META_OAUTH_STATE_EXPIRED"
      ? "OAuth expirado. Tente conectar novamente."
      : "Não foi possível validar o retorno da Meta."
  );
};

export const createMetaOAuthState = (
  payload: Pick<MetaOAuthStatePayload, "companyId" | "instagramAccountId" | "userId">
): string => {
  const secret = readMetaAppSecret();
  const full: MetaOAuthStatePayload = {
    ...payload,
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + STATE_TTL_MS
  };

  const payloadJson = JSON.stringify(full);
  const payloadB64 = base64UrlEncode(payloadJson);
  const signatureB64 = signPayloadBase64(payloadB64, secret);
  const state = `${payloadB64}${STATE_SEPARATOR}${signatureB64}`;

  let payloadDecodeOk = false;
  try {
    base64UrlDecodeToString(payloadB64);
    payloadDecodeOk = true;
  } catch {
    payloadDecodeOk = false;
  }

  logStateDebugStart(state, full.exp, payloadDecodeOk);

  return state;
};

export const verifyMetaOAuthState = (state: string): MetaOAuthStatePayload => {
  const now = Date.now();
  const normalized = normalizeOAuthStateParam(state);
  const secret = readMetaAppSecret();

  const debug: StateDebugLog = {
    ...analyzeStateStructure(normalized),
    payloadDecodeOk: false,
    signatureLength: 0,
    exp: null,
    now,
    verifyResult: "invalid",
    failReason: undefined
  };

  if (!normalized) {
    debug.verifyResult = "invalid";
    debug.failReason = "empty";
    return failStateValidation(debug, "ERR_META_OAUTH_STATE_INVALID");
  }

  const parts = splitStateParts(normalized);
  if (!parts) {
    debug.verifyResult = "invalid";
    debug.failReason = "invalid_format";
    return failStateValidation(debug, "ERR_META_OAUTH_STATE_INVALID");
  }

  const { payloadB64, signatureB64 } = parts;
  debug.signatureLength = signatureB64.length;

  const expectedSignatureB64 = signPayloadBase64(payloadB64, secret);
  if (!timingSafeEqualString(signatureB64.trim(), expectedSignatureB64)) {
    debug.verifyResult = "invalid";
    debug.failReason = "signature_mismatch";
    return failStateValidation(debug, "ERR_META_OAUTH_STATE_INVALID");
  }

  let payloadJson: string;
  try {
    payloadJson = base64UrlDecodeToString(payloadB64);
    debug.payloadDecodeOk = true;
  } catch {
    debug.verifyResult = "invalid";
    debug.failReason = "payload_decode_failed";
    return failStateValidation(debug, "ERR_META_OAUTH_STATE_INVALID");
  }

  let payload: MetaOAuthStatePayload;
  try {
    payload = JSON.parse(payloadJson) as MetaOAuthStatePayload;
  } catch {
    debug.verifyResult = "invalid";
    debug.failReason = "json_parse_failed";
    return failStateValidation(debug, "ERR_META_OAUTH_STATE_INVALID");
  }

  if (
    typeof payload.companyId !== "number" ||
    typeof payload.instagramAccountId !== "number" ||
    typeof payload.userId !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.exp !== "number"
  ) {
    debug.verifyResult = "invalid";
    debug.failReason = "invalid_payload_shape";
    return failStateValidation(debug, "ERR_META_OAUTH_STATE_INVALID");
  }

  debug.exp = payload.exp;
  debug.expired = now > payload.exp;

  if (debug.expired) {
    debug.verifyResult = "expired";
    debug.failReason = "expired";
    return failStateValidation(debug, "ERR_META_OAUTH_STATE_EXPIRED");
  }

  debug.verifyResult = "ok";
  debug.failReason = undefined;
  logStateDebugCallback(debug);

  return payload;
};
