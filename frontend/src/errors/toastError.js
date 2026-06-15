import { toast } from "react-toastify";
import { i18n } from "../translate/i18n";
import { isString } from "lodash";
import { getErrorToastOptions } from "./feedbackToasts";

/**
 * Exibe erro amigável: prioriza códigos `backendErrors.*`, rede e mensagem genérica.
 * Mensagens técnicas sem tradução não são mostradas cruas ao utilizador.
 */
const formatBytesShort = (bytes) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const toastError = (err) => {
  const errOpts = getErrorToastOptions();

  const apiPayload = err?.response?.data;
  const errorCode = apiPayload?.error;
  const apiMessage = apiPayload?.message;

  if (errorCode) {
    if (apiMessage && isString(apiMessage)) {
      const trimmedClient = apiMessage.trim();
      if (trimmedClient && !/^ERR_[A-Z0-9_]+$/.test(trimmedClient)) {
        console.error("[API]", errorCode, trimmedClient);
        toast.error(trimmedClient, {
          ...errOpts,
          toastId: `be-${errorCode}-detail`,
        });
        return;
      }
    }

    if (errorCode === "BACKUP_INSUFFICIENT_DISK_SPACE" && apiPayload?.missingBytes != null) {
      const text = i18n.t("backendErrors.BACKUP_INSUFFICIENT_DISK_SPACE", {
        missing: formatBytesShort(apiPayload.missingBytes),
        available: formatBytesShort(apiPayload.availableBytes),
        needed: formatBytesShort(apiPayload.totalNeeded),
      });
      console.error("[API]", errorCode, text, apiPayload);
      toast.error(text, {
        ...errOpts,
        toastId: `be-${errorCode}`,
      });
      return;
    }
    if (i18n.exists(`backendErrors.${errorCode}`)) {
      const text = i18n.t(`backendErrors.${errorCode}`);
      console.error("[API]", errorCode, text);
      toast.error(text, {
        ...errOpts,
        toastId: `be-${errorCode}`,
      });
      return;
    }
    console.error("[API] código sem tradução:", errorCode);
    toast.error(i18n.t("errors.operationFailed"), {
      ...errOpts,
      toastId: `be-unk-${String(errorCode).slice(0, 40)}`,
    });
    return;
  }

  if (apiMessage && isString(apiMessage)) {
    const trimmed = apiMessage.trim();
    if (trimmed && !/^ERR_[A-Z0-9_]+$/.test(trimmed)) {
      if (i18n.exists(`backendErrors.${trimmed}`)) {
        toast.error(i18n.t(`backendErrors.${trimmed}`), {
          ...errOpts,
          toastId: `be-msg-${trimmed.slice(0, 32)}`,
        });
        return;
      }
      toast.error(trimmed, { ...errOpts, toastId: trimmed.slice(0, 48) });
      return;
    }
  }

  if (isString(err)) {
    console.error("[toastError string]", err);
    toast.error(err, errOpts);
    return;
  }

  const msg = err?.message || err?.response?.statusText;
  const isAxios = err?.isAxiosError === true;
  const isNetworkError =
    err?.message === "Network Error" ||
    err?.code === "ERR_NETWORK" ||
    (isAxios && !err?.response && err?.request);

  console.error("toastError:", err);

  const displayMsg = isNetworkError
    ? i18n.t("errors.connectionError")
    : msg || i18n.t("errors.generic");

  toast.error(displayMsg, errOpts);
};

export default toastError;
