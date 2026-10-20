import {
  EfiCredentialsSource,
  getEfiActivationControls
} from "../../config/saasBillingFlags";

/**
 * Isolamento financeiro da fonte `database` (P-B31-08) — Fase 8.3-B3.1.
 *
 * A B3.1 entrega o provedor de credenciais do banco, mas checkout e webhook continuam no SDK
 * com as variáveis de ambiente (`config/Gn.ts`). Para nenhuma operação financeira misturar
 * fontes (cobrança criada com uma credencial e liquidada com outra), toda operação financeira
 * real — checkout, webhook e settle de Cobranças — usa `legacy_env` até a etapa que migrar as
 * três juntas (B3.2/B3.3) trocar esta constante.
 *
 * É constante de código, não variável de ambiente: liberar exige um release revisado.
 * `EFI_CREDENTIALS_SOURCE=database` continua valendo para diagnóstico (status, provedor
 * com finalidade `diagnostic`).
 */
export const EFI_DATABASE_SOURCE_FINANCIAL_RELEASED = false;

/** Fonte efetiva das operações financeiras reais. */
export function getEfiFinancialCredentialsSource(): EfiCredentialsSource {
  return getEfiActivationControls().credentialsSource === "database" &&
    EFI_DATABASE_SOURCE_FINANCIAL_RELEASED
    ? "database"
    : "legacy_env";
}
