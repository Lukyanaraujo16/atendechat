import AppError from "../errors/AppError";

/**
 * Ambiente operacional StreamHUB (independente de NODE_ENV e hostname).
 * Fase 8.3-B1 — isolamento Efí TESTE vs PRODUÇÃO.
 */
export type StreamhubRuntimeEnv = "test" | "production";

export type PlatformEfiSlot = "homologation" | "production";
export type PlatformEfiApiEnvironment = "sandbox" | "production";

export function getStreamhubRuntimeEnv(): StreamhubRuntimeEnv {
  const raw = (process.env.STREAMHUB_RUNTIME_ENV || "").trim().toLowerCase();
  if (raw === "test" || raw === "production") {
    return raw;
  }
  throw new AppError(
    "ERR_STREAMHUB_RUNTIME_ENV_INVALID",
    500,
    "STREAMHUB_RUNTIME_ENV deve ser 'test' ou 'production'. Operações Efí via resolvedor bloqueadas."
  );
}

export function tryGetStreamhubRuntimeEnv(): StreamhubRuntimeEnv | null {
  try {
    return getStreamhubRuntimeEnv();
  } catch {
    return null;
  }
}

/** Slot permitido para o runtime atual. */
export function getAllowedEfiSlotForRuntime(
  runtime: StreamhubRuntimeEnv
): PlatformEfiSlot {
  return runtime === "test" ? "homologation" : "production";
}

/** Ambiente da API Efí permitido para o runtime. */
export function getAllowedEfiApiEnvironment(
  runtime: StreamhubRuntimeEnv
): PlatformEfiApiEnvironment {
  return runtime === "test" ? "sandbox" : "production";
}

/**
 * Bloqueia slot/ambiente incompatíveis com STREAMHUB_RUNTIME_ENV.
 * Sem fallback silencioso.
 */
export function assertEfiSlotAllowedForRuntime(
  slot: PlatformEfiSlot,
  efiEnvironment: PlatformEfiApiEnvironment
): StreamhubRuntimeEnv {
  const runtime = getStreamhubRuntimeEnv();
  const allowedSlot = getAllowedEfiSlotForRuntime(runtime);
  const allowedEnv = getAllowedEfiApiEnvironment(runtime);

  if (slot !== allowedSlot) {
    throw new AppError(
      "ERR_EFI_SLOT_FORBIDDEN_FOR_RUNTIME",
      403,
      `Runtime '${runtime}' permite apenas o slot '${allowedSlot}'.`
    );
  }
  if (efiEnvironment !== allowedEnv) {
    throw new AppError(
      "ERR_EFI_ENVIRONMENT_FORBIDDEN_FOR_RUNTIME",
      403,
      `Runtime '${runtime}' permite apenas API Efí '${allowedEnv}'.`
    );
  }
  return runtime;
}
