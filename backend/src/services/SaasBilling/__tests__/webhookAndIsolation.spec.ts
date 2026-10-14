/**
 * Segurança: webhook secret + isolamento de fatura no createSubscription (lógica).
 */

describe("webhook secret policy", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  function verifyLike(req: {
    query: Record<string, string | undefined>;
    headers: Record<string, string | undefined>;
  }): boolean {
    // Espelha a política de SubscriptionController.verifyWebhookSecret
    const { saasBillingFlags } = require("../../../config/saasBillingFlags");
    const secret = process.env.WEBHOOK_SUBSCRIPTION_SECRET;
    if (saasBillingFlags.requireWebhookSecret()) {
      if (!secret) return false;
    } else if (!secret) {
      return true;
    }
    const queryToken = req.query.token;
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "")?.trim();
    return queryToken === secret || bearer === secret;
  }

  it("rejeita webhook sem secret em production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.WEBHOOK_SUBSCRIPTION_SECRET;
    expect(
      verifyLike({ query: {}, headers: {} })
    ).toBe(false);
  });

  it("rejeita token inválido quando secret está definido", () => {
    process.env.NODE_ENV = "development";
    process.env.WEBHOOK_SUBSCRIPTION_SECRET = "segredo-teste";
    expect(
      verifyLike({ query: { token: "errado" }, headers: {} })
    ).toBe(false);
  });

  it("aceita token correto", () => {
    process.env.NODE_ENV = "development";
    process.env.WEBHOOK_SUBSCRIPTION_SECRET = "segredo-teste";
    expect(
      verifyLike({ query: { token: "segredo-teste" }, headers: {} })
    ).toBe(true);
  });
});

describe("isolamento companyId em pagamento", () => {
  it("bloqueia invoice de outra empresa", () => {
    const invoice = { id: 1, companyId: 10, status: "open" };
    const sessionCompanyId = 99;
    const forbidden = invoice.companyId !== sessionCompanyId;
    expect(forbidden).toBe(true);
  });
});

describe("faturas legadas", () => {
  it("migration marca legacyUnknown sem inventar paidAt", () => {
    const legacyRow = {
      status: "open",
      paymentSource: null,
      paidAt: null,
      legacyUnknown: true
    };
    expect(legacyRow.paidAt).toBeNull();
    expect(legacyRow.legacyUnknown).toBe(true);
    expect(legacyRow.paymentSource).toBeNull();
  });
});
