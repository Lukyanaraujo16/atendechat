import {
  EfiCredentialsSource,
  getEfiActivationControls
} from "../../config/saasBillingFlags";
import {
  StreamhubRuntimeEnv,
  tryGetStreamhubRuntimeEnv
} from "../../config/streamhubRuntimeEnv";

/**
 * Liberações de código da Fase 8.3-B3 (B31-T17, B32-T1, B33-T1, B34-T1).
 *
 * Cada funcionalidade financeira nova só vale com o controle de ambiente ligado **e** liberada
 * aqui para o runtime em execução (`STREAMHUB_RUNTIME_ENV`). Variável de ambiente sozinha não
 * ativa nada; liberar exige um release revisado que acrescente o runtime à lista.
 *
 * Por runtime (e não um booleano global): o mesmo commit homologado em TESTE pode ir para
 * PRODUÇÃO sem liberar nada lá (HOMOLOGACAO §9.4). Liberar em PRODUÇÃO é outro release, que
 * também passa por TESTE antes (em TESTE, `"production"` na lista não tem efeito).
 *
 * - `databaseFinancial`: fonte `database` nas operações financeiras reais (P-B31-08). Sem ela,
 *   checkout, webhook e settle usam `legacy_env` mesmo com `EFI_CREDENTIALS_SOURCE=database`.
 * - `pixChargeV2`: cobrança Pix v2 (B3.2); tira o `pixConfigWebhook` do checkout.
 * - `webhookPipeline`: pipeline assíncrono do webhook (B3.3), inclusive o ramo D-P6.
 * - `pixReconciliationSweep`: varredura Pix Efí × local (B3.3, só leitura na Efí).
 */
export const EFI_RELEASED_RUNTIMES: Readonly<
  Record<
    "databaseFinancial" | "pixChargeV2" | "webhookPipeline" | "pixReconciliationSweep",
    readonly StreamhubRuntimeEnv[]
  >
> = Object.freeze({
  databaseFinancial: [],
  pixChargeV2: [],
  webhookPipeline: [],
  pixReconciliationSweep: []
});

export type EfiReleasedFeature = keyof typeof EFI_RELEASED_RUNTIMES;

/** Regra pura da liberação: runtime ausente/inválido nunca libera. */
export function isRuntimeReleased(
  released: readonly StreamhubRuntimeEnv[],
  runtime: StreamhubRuntimeEnv | null
): boolean {
  return runtime !== null && released.includes(runtime);
}

/** Liberada no código para o runtime atual? */
export function isEfiFeatureReleased(feature: EfiReleasedFeature): boolean {
  return isRuntimeReleased(EFI_RELEASED_RUNTIMES[feature], tryGetStreamhubRuntimeEnv());
}

/** Fonte efetiva das operações financeiras reais. */
export function getEfiFinancialCredentialsSource(): EfiCredentialsSource {
  return getEfiActivationControls().credentialsSource === "database" &&
    isEfiFeatureReleased("databaseFinancial")
    ? "database"
    : "legacy_env";
}

/** Cobrança v2 efetivamente ativa: controle de ambiente ligado e liberação de código. */
export function isEfiPixChargeV2Active(): boolean {
  return getEfiActivationControls().pixChargeV2Enabled && isEfiFeatureReleased("pixChargeV2");
}

/** Pipeline `async` efetivamente ativo: controle de ambiente e liberação de código. Senão, webhook legado (C4). */
export function isEfiWebhookPipelineAsyncActive(): boolean {
  return (
    getEfiActivationControls().webhookPipeline === "async" && isEfiFeatureReleased("webhookPipeline")
  );
}

/** Varredura Pix ativa: controle de ambiente e liberação de código. */
export function isEfiPixReconciliationSweepActive(): boolean {
  return (
    getEfiActivationControls().pixReconciliationSweepEnabled &&
    isEfiFeatureReleased("pixReconciliationSweep")
  );
}
