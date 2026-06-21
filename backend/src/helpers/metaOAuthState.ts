import crypto from "crypto";
import AppError from "../errors/AppError";
import {
  getMissingMetaOAuthStateKeys,
  logMetaOAuthConfigCheck,
  logMetaOAuthConfigMissing
} from "./metaOAuthConfigCheck";

export interface MetaOAuthStatePayload {
  companyId: number;
  instagramAccountId: number;
  userId: string;
  nonce: string;
  exp: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;

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

const signPayload = (payloadB64: string): string =>
  crypto.createHmac("sha256", getStateSecret()).update(payloadB64).digest("base64url");

export const createMetaOAuthState = (
  payload: Pick<MetaOAuthStatePayload, "companyId" | "instagramAccountId" | "userId">
): string => {
  const full: MetaOAuthStatePayload = {
    ...payload,
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + STATE_TTL_MS
  };

  const payloadB64 = Buffer.from(JSON.stringify(full)).toString("base64url");
  const signature = signPayload(payloadB64);
  return `${payloadB64}.${signature}`;
};

export const verifyMetaOAuthState = (state: string): MetaOAuthStatePayload => {
  if (!state?.trim()) {
    throw new AppError(
      "ERR_META_OAUTH_STATE_INVALID",
      400,
      "Não foi possível validar o retorno da Meta."
    );
  }

  const separatorIndex = state.lastIndexOf(".");
  if (separatorIndex <= 0) {
    throw new AppError(
      "ERR_META_OAUTH_STATE_INVALID",
      400,
      "Não foi possível validar o retorno da Meta."
    );
  }

  const payloadB64 = state.slice(0, separatorIndex);
  const signature = state.slice(separatorIndex + 1);
  const expectedSignature = signPayload(payloadB64);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new AppError(
      "ERR_META_OAUTH_STATE_INVALID",
      400,
      "Não foi possível validar o retorno da Meta."
    );
  }

  let payload: MetaOAuthStatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as MetaOAuthStatePayload;
  } catch {
    throw new AppError(
      "ERR_META_OAUTH_STATE_INVALID",
      400,
      "Não foi possível validar o retorno da Meta."
    );
  }

  if (
    typeof payload.companyId !== "number" ||
    typeof payload.instagramAccountId !== "number" ||
    typeof payload.userId !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.exp !== "number"
  ) {
    throw new AppError(
      "ERR_META_OAUTH_STATE_INVALID",
      400,
      "Não foi possível validar o retorno da Meta."
    );
  }

  if (Date.now() > payload.exp) {
    throw new AppError(
      "ERR_META_OAUTH_STATE_EXPIRED",
      400,
      "OAuth expirado. Tente conectar novamente."
    );
  }

  return payload;
};
