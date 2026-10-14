import { saasBillingFlags } from "../../../config/saasBillingFlags";

describe("Efí flags safety for TESTE", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("boleto, card e settle OFF por default", () => {
    delete process.env.EFI_BOLETO_ENABLED;
    delete process.env.EFI_CARD_ENABLED;
    delete process.env.EFI_COBRANCAS_SETTLE_ENABLED;
    expect(saasBillingFlags.boletoEnabled()).toBe(false);
    expect(saasBillingFlags.cardEnabled()).toBe(false);
    expect(saasBillingFlags.cobrancasSettleEnabled()).toBe(false);
  });

  it("auto invoice OFF por default", () => {
    delete process.env.SAAS_BILLING_AUTO_INVOICE;
    expect(saasBillingFlags.autoInvoice()).toBe(false);
  });

  it("sandbox default true (homologação segura)", () => {
    delete process.env.GERENCIANET_SANDBOX;
    expect(saasBillingFlags.gerencianetSandbox()).toBe(true);
  });

  it("native subscription OFF", () => {
    delete process.env.EFI_NATIVE_SUBSCRIPTION_ENABLED;
    expect(saasBillingFlags.nativeSubscriptionEnabled()).toBe(false);
  });
});
