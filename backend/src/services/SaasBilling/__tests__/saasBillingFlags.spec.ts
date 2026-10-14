import { saasBillingFlags } from "../../../config/saasBillingFlags";

describe("saasBillingFlags", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("autoInvoice default false", () => {
    delete process.env.SAAS_BILLING_AUTO_INVOICE;
    expect(saasBillingFlags.autoInvoice()).toBe(false);
  });

  it("gerencianetSandbox default true quando env ausente", () => {
    delete process.env.GERENCIANET_SANDBOX;
    expect(saasBillingFlags.gerencianetSandbox()).toBe(true);
  });

  it("cobrancasSettle default false", () => {
    delete process.env.EFI_COBRANCAS_SETTLE_ENABLED;
    expect(saasBillingFlags.cobrancasSettleEnabled()).toBe(false);
  });

  it("requireWebhookSecret true fora de development/test", () => {
    process.env.NODE_ENV = "production";
    expect(saasBillingFlags.requireWebhookSecret()).toBe(true);
  });
});
