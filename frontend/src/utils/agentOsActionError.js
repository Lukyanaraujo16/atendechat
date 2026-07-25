import { toast } from "react-toastify";
import { i18n } from "../translate/i18n";
import toastError from "../errors/toastError";
import { getErrorToastOptions } from "../errors/feedbackToasts";

/**
 * Erro de ação do Console Técnico.
 * 403 de plataforma: mensagem segura sem desmontar a página / sem permission key.
 * 401: delega ao toastError (fluxo global de sessão).
 */
export function toastAgentOsActionError(err) {
  const status = err?.response?.status;
  const code = err?.response?.data?.error;

  if (status === 403 || code === "ERR_PLATFORM_PERMISSION_DENIED") {
    toast.error(i18n.t("technicalConsole.actionDenied.message"), {
      ...getErrorToastOptions(),
      toastId: "agentos-action-denied",
    });
    return;
  }

  toastError(err);
}

export function isAgentOsPermissionDenied(err) {
  const status = err?.response?.status;
  const code = err?.response?.data?.error;
  return status === 403 || code === "ERR_PLATFORM_PERMISSION_DENIED";
}
