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

/** Ambiente da API Efí padrão do runtime (usado ao criar o slot). */
export function getAllowedEfiApiEnvironment(
  runtime: StreamhubRuntimeEnv
): PlatformEfiApiEnvironment {
  return runtime === "test" ? "sandbox" : "production";
}

/**
 * B3.4 (Opção B, DECISOES B34-T10): autorização explícita para o runtime `test` usar a API Efí
 * de PRODUÇÃO no slot `homologation`. Default desligado; só o valor exato `true` liga.
 * Ignorada no runtime `production`.
 */
export function isEfiProductionApiAllowedInTestRuntime(): boolean {
  return (
    (process.env.EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API || "")
      .trim()
      .toLowerCase() === "true"
  );
}

/** Ambientes da API Efí aceitos no runtime (lido a cada chamada: remover a autorização bloqueia na hora). */
export function getPermittedEfiApiEnvironments(
  runtime: StreamhubRuntimeEnv
): PlatformEfiApiEnvironment[] {
  if (runtime === "production") return ["production"];
  return isEfiProductionApiAllowedInTestRuntime()
    ? ["sandbox", "production"]
    : ["sandbox"];
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
  const permittedEnvs = getPermittedEfiApiEnvironments(runtime);

  if (slot !== allowedSlot) {
    throw new AppError(
      "ERR_EFI_SLOT_FORBIDDEN_FOR_RUNTIME",
      403,
      `Runtime '${runtime}' permite apenas o slot '${allowedSlot}'.`
    );
  }
  if (!permittedEnvs.includes(efiEnvironment)) {
    throw new AppError(
      "ERR_EFI_ENVIRONMENT_FORBIDDEN_FOR_RUNTIME",
      403,
      runtime === "test" && efiEnvironment === "production"
        ? "Runtime 'test' só usa a API Efí de produção com EFI_TEST_RUNTIME_ALLOW_PRODUCTION_API=true."
        : `Runtime '${runtime}' permite apenas API Efí '${permittedEnvs.join(
            "' ou '"
          )}'.`
    );
  }
  return runtime;
}
