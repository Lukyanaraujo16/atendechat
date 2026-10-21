import {
  EFI_RELEASED_RUNTIMES,
  EfiReleasedFeature,
  evaluateEfiActivation
} from "../efiFinancialSource";

/**
 * Guarda B34-T7: cobrança v2, pipeline async e varredura só valem com a fonte `database` efetiva no
 * mesmo runtime. Sem isso usariam `GERENCIANET_*` do ambiente (na VPS de TESTE, conta de produção).
 */
describe("efiActivationGuard (B34-T7)", () => {
  const allOn = {
    credentialsSource: "database" as const,
    pixChargeV2Enabled: true,
    webhookPipeline: "async" as const,
    pixReconciliationSweepEnabled: true
  };
  const releasedTest = {
    databaseFinancial: ["test"],
    pixChargeV2: ["test"],
    webhookPipeline: ["test"],
    pixReconciliationSweep: ["test"]
  } as const;

  it("tudo liberado e ligado no runtime test: ativo com fonte database", () => {
    expect(evaluateEfiActivation(allOn, releasedTest, "test")).toEqual({
      credentialsSource: "database",
      pixChargeV2: true,
      webhookPipeline: true,
      pixReconciliationSweep: true
    });
  });

  it("estado misto: liberado sem databaseFinancial nunca ativa (não cai em credencial legada)", () => {
    const mixed = { ...releasedTest, databaseFinancial: [] as const };
    expect(evaluateEfiActivation(allOn, mixed, "test")).toEqual({
      credentialsSource: "legacy_env",
      pixChargeV2: false,
      webhookPipeline: false,
      pixReconciliationSweep: false
    });
  });

  it("EFI_CREDENTIALS_SOURCE=legacy_env com tudo liberado: nada dependente ativa", () => {
    const r = evaluateEfiActivation({ ...allOn, credentialsSource: "legacy_env" }, releasedTest, "test");
    expect(r).toEqual({
      credentialsSource: "legacy_env",
      pixChargeV2: false,
      webhookPipeline: false,
      pixReconciliationSweep: false
    });
  });

  it("databaseFinancial liberado para outro runtime não vale", () => {
    const other = { ...releasedTest, databaseFinancial: ["production"] as const };
    expect(evaluateEfiActivation(allOn, other, "test").webhookPipeline).toBe(false);
    expect(evaluateEfiActivation(allOn, releasedTest, "production").pixChargeV2).toBe(false);
  });

  it("runtime ausente: legado e nada ativo", () => {
    expect(evaluateEfiActivation(allOn, releasedTest, null)).toEqual({
      credentialsSource: "legacy_env",
      pixChargeV2: false,
      webhookPipeline: false,
      pixReconciliationSweep: false
    });
  });

  it("controle desligado continua desligado (defaults)", () => {
    const off = {
      credentialsSource: "database" as const,
      pixChargeV2Enabled: false,
      webhookPipeline: "legacy" as const,
      pixReconciliationSweepEnabled: false
    };
    expect(evaluateEfiActivation(off, releasedTest, "test")).toEqual({
      credentialsSource: "database",
      pixChargeV2: false,
      webhookPipeline: false,
      pixReconciliationSweep: false
    });
  });

  it("invariante do release: todo runtime liberado numa funcionalidade dependente também libera databaseFinancial", () => {
    const dependents: EfiReleasedFeature[] = ["pixChargeV2", "webhookPipeline", "pixReconciliationSweep"];
    for (const f of dependents) {
      for (const runtime of EFI_RELEASED_RUNTIMES[f]) {
        expect(EFI_RELEASED_RUNTIMES.databaseFinancial).toContain(runtime);
      }
    }
  });
});

describe("bloqueio de rede Efí nos testes (B34-T8)", () => {
  it("tls.connect para hosts da Efí falha antes de abrir conexão", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tls = require("tls");
    for (const host of ["pix.api.efipay.com.br", "pix-h.api.efipay.com.br", "cobrancas.api.efipay.com.br", "api-pix.gerencianet.com.br"]) {
      expect(() => tls.connect({ host, port: 443, servername: host })).toThrow(/bloqueada/);
    }
  });
});
