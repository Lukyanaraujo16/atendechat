import {
  EfiActivationControls,
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
 *
 * Guarda B34-T7: `pixChargeV2`, `webhookPipeline` e `pixReconciliationSweep` só valem com a fonte
 * `database` efetiva no mesmo runtime (controle `EFI_CREDENTIALS_SOURCE=database` + `databaseFinancial`
 * liberado). Sem ela usariam as credenciais `GERENCIANET_*` do ambiente, que podem ser de produção.
 */
export const EFI_RELEASED_RUNTIMES: Readonly<
  Record<
    "databaseFinancial" | "pixChargeV2" | "webhookPipeline" | "pixReconciliationSweep",
    readonly StreamhubRuntimeEnv[]
  >
> = Object.freeze({
  databaseFinancial: ["test", "production"],
  pixChargeV2: ["test", "production"],
  webhookPipeline: ["test", "production"],
  pixReconciliationSweep: ["test", "production"]
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

export type EfiEffectiveActivation = {
  credentialsSource: EfiCredentialsSource;
  pixChargeV2: boolean;
  webhookPipeline: boolean;
  pixReconciliationSweep: boolean;
};

/** Regra pura da ativação efetiva (controles × liberação × runtime), incluindo a guarda B34-T7. */
export function evaluateEfiActivation(
  controls: Pick<
    EfiActivationControls,
    "credentialsSource" | "pixChargeV2Enabled" | "webhookPipeline" | "pixReconciliationSweepEnabled"
  >,
  released: Readonly<Record<EfiReleasedFeature, readonly StreamhubRuntimeEnv[]>>,
  runtime: StreamhubRuntimeEnv | null
): EfiEffectiveActivation {
  const onDatabase =
    controls.credentialsSource === "database" &&
    isRuntimeReleased(released.databaseFinancial, runtime);
  const dependent = (on: boolean, feature: EfiReleasedFeature) =>
    on && onDatabase && isRuntimeReleased(released[feature], runtime);
  return {
    credentialsSource: onDatabase ? "database" : "legacy_env",
    pixChargeV2: dependent(controls.pixChargeV2Enabled, "pixChargeV2"),
    webhookPipeline: dependent(controls.webhookPipeline === "async", "webhookPipeline"),
    pixReconciliationSweep: dependent(controls.pixReconciliationSweepEnabled, "pixReconciliationSweep")
  };
}

function currentActivation(): EfiEffectiveActivation {
  return evaluateEfiActivation(
    getEfiActivationControls(),
    EFI_RELEASED_RUNTIMES,
    tryGetStreamhubRuntimeEnv()
  );
}

/** Fonte efetiva das operações financeiras reais. */
export function getEfiFinancialCredentialsSource(): EfiCredentialsSource {
  return currentActivation().credentialsSource;
}

/** Cobrança v2 efetivamente ativa: controle, liberação e fonte `database` efetiva. */
export function isEfiPixChargeV2Active(): boolean {
  return currentActivation().pixChargeV2;
}

/** Pipeline `async` efetivamente ativo (controle, liberação e fonte `database`). Senão, webhook legado (C4). */
export function isEfiWebhookPipelineAsyncActive(): boolean {
  return currentActivation().webhookPipeline;
}

/**
 * O checkout legado recadastra o webhook da chave (`pixConfigWebhook`) só com a fonte `legacy_env`.
 * Com a fonte `database` efetiva o webhook é gerido pelo painel (B3): a URL legada (`?token=` do env)
 * derrubaria a recepção B3, que valida o secret do slot (ex.: rollback só da v2).
 */
export function isLegacyPixWebhookRegistrationAllowed(): boolean {
  return currentActivation().credentialsSource !== "database";
}

/** Varredura Pix ativa: controle, liberação e fonte `database` efetiva. */
export function isEfiPixReconciliationSweepActive(): boolean {
  return currentActivation().pixReconciliationSweep;
}
