/** 403 de plano/permissão granular (toast global indevido em chamadas auxiliares). */
export function isForbiddenPermissionError(err) {
  const status = err?.response?.status;
  if (status !== 403) return false;
  const code = err?.response?.data?.error;
  const msg = String(err?.response?.data?.message || "").trim();
  return (
    code === "ERR_USER_FEATURE_DISABLED" ||
    code === "ERR_NO_PERMISSION" ||
    code === "ERR_PLAN_FEATURE_DISABLED" ||
    code === "ERR_MODULE_NOT_ALLOWED" ||
    msg === "Você não tem permissão para acessar este recurso." ||
    msg === "Este recurso não está disponível no seu plano."
  );
}
