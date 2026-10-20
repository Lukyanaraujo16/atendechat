import { getEfiActivationControls } from "../../../config/saasBillingFlags";
import { getAppBuildCommit, isSameAppCommit } from "../../../config/appBuildInfo";
import { logger } from "../../../utils/logger";
import { logEfiActivationControlsAtBoot } from "../efiIntegrationStatus";

const CONTROL_KEYS = [
  "EFI_CREDENTIALS_SOURCE",
  "EFI_PIX_CHARGE_V2_ENABLED",
  "EFI_WEBHOOK_PIPELINE",
  "EFI_WEBHOOK_WORKER_PAUSED",
  "EFI_PIX_RECONCILIATION_SWEEP_ENABLED",
  "TRUST_PROXY_HOPS"
];

describe("B3.1 — controles de ativação (RF0) e versão (PT-9)", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    CONTROL_KEYS.forEach(k => delete process.env[k]);
    ["GIT_COMMIT", "COMMIT_SHA", "GIT_SHA", "BACKEND_BUILD_STAMP"].forEach(
      k => delete process.env[k]
    );
  });

  afterAll(() => {
    process.env = original;
  });

  it("T-ACT-01/T-CRED-01: todos ausentes → defaults = comportamento atual", () => {
    expect(getEfiActivationControls()).toEqual({
      credentialsSource: "legacy_env",
      pixChargeV2Enabled: false,
      webhookPipeline: "legacy",
      webhookWorkerPaused: false,
      pixReconciliationSweepEnabled: false,
      trustProxyHops: null,
      invalid: []
    });
  });

  it("T-CRED-02: valores inválidos caem no default e são sinalizados", () => {
    process.env.EFI_CREDENTIALS_SOURCE = "foo";
    process.env.EFI_WEBHOOK_PIPELINE = "turbo";
    process.env.EFI_PIX_CHARGE_V2_ENABLED = "yes";
    process.env.TRUST_PROXY_HOPS = "abc";
    const c = getEfiActivationControls();
    expect(c.credentialsSource).toBe("legacy_env");
    expect(c.webhookPipeline).toBe("legacy");
    expect(c.pixChargeV2Enabled).toBe(false);
    expect(c.trustProxyHops).toBeNull();
    expect(c.invalid.sort()).toEqual(
      [
        "EFI_CREDENTIALS_SOURCE",
        "EFI_PIX_CHARGE_V2_ENABLED",
        "EFI_WEBHOOK_PIPELINE",
        "TRUST_PROXY_HOPS"
      ].sort()
    );
  });

  it("aceita valores válidos explícitos", () => {
    process.env.EFI_CREDENTIALS_SOURCE = " Database ";
    process.env.EFI_PIX_CHARGE_V2_ENABLED = "true";
    process.env.EFI_WEBHOOK_PIPELINE = "async";
    process.env.EFI_WEBHOOK_WORKER_PAUSED = "1";
    process.env.EFI_PIX_RECONCILIATION_SWEEP_ENABLED = "false";
    process.env.TRUST_PROXY_HOPS = "1";
    const c = getEfiActivationControls();
    expect(c).toMatchObject({
      credentialsSource: "database",
      pixChargeV2Enabled: true,
      webhookPipeline: "async",
      webhookWorkerPaused: true,
      pixReconciliationSweepEnabled: false,
      trustProxyHops: 1,
      invalid: []
    });
  });

  it("T-ACT-02: log de boot traz o valor efetivo, sem segredos", () => {
    process.env.GERENCIANET_CLIENT_SECRET = "SECRET_SHOULD_NOT_APPEAR";
    process.env.EFI_CREDENTIALS_SOURCE = "foo";
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined as never);
    logEfiActivationControlsAtBoot();
    expect(warn).toHaveBeenCalledTimes(1);
    const [payload] = warn.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(payload).toMatchObject({
      credentialsSource: "legacy_env",
      invalid: ["EFI_CREDENTIALS_SOURCE"],
      currentCommit: null
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("SECRET_SHOULD_NOT_APPEAR");
    warn.mockRestore();
  });

  it("P-B31-08: database configurado → aviso de boot; financeiro segue em legacy_env", () => {
    process.env.EFI_CREDENTIALS_SOURCE = "database";
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined as never);
    const info = jest.spyOn(logger, "info").mockImplementation(() => undefined as never);
    logEfiActivationControlsAtBoot();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        credentialsSource: "database",
        financialCredentialsSource: "legacy_env"
      }),
      expect.stringContaining("ainda não liberado para o financeiro")
    );
    warn.mockRestore();
    info.mockRestore();
  });

  it("PT-9: commit vem de GIT_COMMIT (ou nomes legados) e só aceita SHA", () => {
    expect(getAppBuildCommit()).toBeNull();
    process.env.BACKEND_BUILD_STAMP = "build-42";
    expect(getAppBuildCommit()).toBeNull();
    process.env.GIT_SHA = "ABCDEF1";
    expect(getAppBuildCommit()).toBe("abcdef1");
    process.env.GIT_COMMIT = "1234567890abcdef1234567890abcdef12345678";
    expect(getAppBuildCommit()).toBe("1234567890abcdef1234567890abcdef12345678");
  });

  it("PT-9: comparação aceita abreviação e nunca iguala desconhecido", () => {
    expect(isSameAppCommit("abcdef1", "abcdef1234")).toBe(true);
    expect(isSameAppCommit("abcdef1", "abcdef2")).toBe(false);
    expect(isSameAppCommit(null, "abcdef1")).toBe(false);
    expect(isSameAppCommit(null, null)).toBe(false);
  });
});
