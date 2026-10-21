import axios from "axios";
import * as efiFinancialSource from "../efiFinancialSource";
import * as runtimeCredentials from "../efiRuntimeCredentials";
import {
  buildPixV2Txid,
  chargeMatchesInvoice,
  formatEfiAmount,
  PIX_V2_TXID_RE
} from "../createOrReusePixCharge";
import { getEfiPixChargeGateway, isEfiPixRetryable } from "../efiPixChargeGateway";
import { maskPixKey, maskWebhookUrl, registerEfiWebhookForAdmin } from "../efiPixAdminService";
import { EFI_PIX_REQUEST_TIMEOUT_MS, invalidateEfiPixTokenCache } from "../efiPixClient";
import { efiTestP12 } from "./fixtures/efiTestP12";

/** B3.2 — unidade: txid, conferência, gate do v2 e gateway (SDK e cliente próprio). */
const mockSdk = {
  pixCreateCharge: jest.fn(),
  pixDetailCharge: jest.fn(),
  pixGenerateQRCode: jest.fn(),
  pixConfigWebhook: jest.fn(),
  pixDetailWebhook: jest.fn()
};
jest.mock("gn-api-sdk-typescript", () => () => mockSdk);
jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

describe("B3.2 — cobrança Pix v2 (unidade)", () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    process.env = { ...originalEnv, GERENCIANET_PIX_KEY: "chave-env", GERENCIANET_SANDBOX: "true" };
    jest.restoreAllMocks();
    Object.values(mockSdk).forEach(m => m.mockReset());
    invalidateEfiPixTokenCache();
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  it("T-CHG-07: txid local [a-zA-Z0-9]{26,35}, único por tentativa", () => {
    const a = buildPixV2Txid(12, 34);
    const b = buildPixV2Txid(12, 35);
    expect(a).toMatch(PIX_V2_TXID_RE);
    expect(a).toHaveLength(31);
    expect(a.startsWith("shc0000000012000000003")).toBe(true);
    expect(a).not.toBe(b);
    expect(buildPixV2Txid(12, 34)).not.toBe(a); // parte aleatória: sem colisão entre bancos
    expect(buildPixV2Txid(9999999999, 9999999999, "ffffffff")).toMatch(PIX_V2_TXID_RE);
  });

  it("valor no formato da Efí (o legado quebra acima de 999,99)", () => {
    expect(formatEfiAmount(1234.5)).toBe("1234.50");
    expect(formatEfiAmount("99.9")).toBe("99.90");
    expect(formatEfiAmount(0.1 + 0.2)).toBe("0.30");
  });

  it("conferência da cobrança: valor, chave e #Fatura", () => {
    const cob = { txid: "x", status: "ATIVA", valor: { original: "100.00" }, chave: "k", solicitacaoPagador: "#Fatura:5" };
    expect(chargeMatchesInvoice(cob, { id: 5, value: 100 }, "k")).toEqual({ ok: true, reason: null });
    expect(chargeMatchesInvoice(cob, { id: 5, value: "100.01" }, "k").reason).toBe("valor");
    expect(chargeMatchesInvoice(cob, { id: 5, value: 100 }, "outra").reason).toBe("chave");
    expect(chargeMatchesInvoice(cob, { id: 6, value: 100 }, "k").reason).toBe("solicitacaoPagador");
  });

  it("gate: EFI_PIX_CHARGE_V2_ENABLED=true sozinho não ativa a v2", () => {
    expect(efiFinancialSource.EFI_RELEASED_RUNTIMES.pixChargeV2).toEqual([]);
    process.env.EFI_PIX_CHARGE_V2_ENABLED = "true";
    expect(efiFinancialSource.isEfiPixChargeV2Active()).toBe(false);
  });

  it("T-SEC-08: máscaras de URL e chave (sem secret)", () => {
    expect(maskWebhookUrl("https://a.test/subscription/webhook?token=SEGREDO&x=1")).toBe(
      "https://a.test/subscription/webhook?token=***&x=***"
    );
    expect(maskWebhookUrl("https://a.test/w?ignorar")).toBe("https://a.test/w?ignorar");
    expect(maskPixKey("chave-aleatoria-1234")).toBe("****1234");
    expect(maskPixKey("abc")).toBe("****");
  });

  it("T-ACT-05: cadastro admin recusado com v2 inativa, sem chamar a Efí", async () => {
    await expect(registerEfiWebhookForAdmin({ actorUserId: 1, confirm: true })).rejects.toMatchObject({
      message: "ERR_EFI_WEBHOOK_REGISTER_REQUIRES_V2",
      statusCode: 409
    });
    expect(mockSdk.pixConfigWebhook).not.toHaveBeenCalled();
  });

  describe("gateway legacy_env (SDK)", () => {
    it("usa o SDK com txid local, contexto env e mesma conta do checkout", async () => {
      const gw = await getEfiPixChargeGateway();
      expect(gw.context).toEqual({
        source: "legacy_env",
        configId: null,
        slot: null,
        efiEnvironment: "sandbox",
        configFingerprint: null,
        pixKey: "chave-env"
      });
      mockSdk.pixCreateCharge.mockResolvedValue({ txid: "t", status: "ATIVA" });
      const body = { calendario: { expiracao: 3600 }, valor: { original: "1.00" }, chave: "chave-env", solicitacaoPagador: "#Fatura:1" };
      await gw.putCharge("t", body);
      expect(mockSdk.pixCreateCharge).toHaveBeenCalledWith({ txid: "t" }, body);
    });

    it("T-CHG-17 (unidade): 409 txid_duplicado → ERR_EFI_PIX_TXID_CONFLICT, não transitório", async () => {
      mockSdk.pixCreateCharge.mockRejectedValue({ nome: "txid_duplicado", mensagem: "Campo txid informado já foi utilizado em outra cobrança" });
      const gw = await getEfiPixChargeGateway();
      const err: any = await gw.putCharge("t", {} as any).catch(e => e);
      expect(err).toMatchObject({ message: "ERR_EFI_PIX_TXID_CONFLICT", statusCode: 409 });
      expect(isEfiPixRetryable(err)).toBe(false);
    });

    it("T-NET-04: 4xx (chave inválida) → erro sanitizado, sem retry", async () => {
      mockSdk.pixCreateCharge.mockRejectedValue({ nome: "chave_invalida", mensagem: "chave inválida client_secret=VAZOU Bearer tok.x" });
      const gw = await getEfiPixChargeGateway();
      const err: any = await gw.putCharge("t", {} as any).catch(e => e);
      expect(err.message).toBe("ERR_EFI_PIX_REJECTED");
      expect(isEfiPixRetryable(err)).toBe(false);
      expect(JSON.stringify(err)).not.toMatch(/VAZOU|tok\.x/);
    });

    it("5xx/erro_aplicacao → transitório", async () => {
      mockSdk.pixCreateCharge.mockRejectedValue({ nome: "erro_aplicacao", mensagem: "erro" });
      const gw = await getEfiPixChargeGateway();
      const err: any = await gw.putCharge("t", {} as any).catch(e => e);
      expect(err.message).toBe("ERR_EFI_PIX_UNAVAILABLE");
      expect(isEfiPixRetryable(err)).toBe(true);
    });

    it("SDK pendurado (rede sem resposta) → timeout tipado de 20 s, sem promise eterna", async () => {
      jest.useFakeTimers();
      mockSdk.pixCreateCharge.mockReturnValue(new Promise(() => undefined));
      const gw = await getEfiPixChargeGateway();
      const pending = gw.putCharge("t", {} as any).catch(e => e);
      jest.advanceTimersByTime(EFI_PIX_REQUEST_TIMEOUT_MS + 1);
      const err: any = await pending;
      jest.useRealTimers();
      expect(err).toMatchObject({ message: "ERR_EFI_PIX_TIMEOUT", statusCode: 504 });
      expect(isEfiPixRetryable(err)).toBe(true);
    });

    it("GET de cobrança inexistente → null", async () => {
      mockSdk.pixDetailCharge.mockRejectedValue({ nome: "cobranca_nao_encontrada", mensagem: "x" });
      const gw = await getEfiPixChargeGateway();
      await expect(gw.getCharge("t")).resolves.toBeNull();
    });

    it("chave Pix do env ausente → erro tipado", async () => {
      delete process.env.GERENCIANET_PIX_KEY;
      await expect(getEfiPixChargeGateway()).rejects.toMatchObject({ message: "ERR_EFI_PIX_KEY_MISSING" });
    });
  });

  describe("gateway database (cliente próprio; só alcançável quando liberado)", () => {
    beforeEach(() => {
      jest.spyOn(efiFinancialSource, "getEfiFinancialCredentialsSource").mockReturnValue("database");
      jest.spyOn(runtimeCredentials, "getEfiRuntimeCredentials").mockResolvedValue({
        source: "database",
        efiEnvironment: "sandbox",
        slot: "homologation",
        configId: 7,
        configFingerprint: "f".repeat(64),
        clientId: "id",
        clientSecret: "secret",
        pixKey: "chave-db",
        webhookSecret: "w".repeat(40),
        cobrancasClientId: "id",
        cobrancasClientSecret: "secret",
        certificate: { kind: "memory", pfx: efiTestP12() },
        tokenCacheKey: "db:7:1:sandbox"
      });
      jest.spyOn(axios, "post").mockResolvedValue({ status: 200, data: { access_token: "tok", expires_in: 3600 } });
    });

    it("PUT/GET /v2/cob/:txid na base do slot; contexto com configId", async () => {
      const req = jest.spyOn(axios, "request").mockResolvedValue({ status: 201, data: { txid: "t", status: "ATIVA" } } as any);
      const gw = await getEfiPixChargeGateway();
      expect(gw.context).toMatchObject({ source: "database", configId: 7, slot: "homologation", pixKey: "chave-db" });
      await gw.putCharge("t", { a: 1 } as any);
      expect(req.mock.calls[0][0]).toMatchObject({
        method: "PUT",
        url: "https://pix-h.api.efipay.com.br/v2/cob/t",
        data: { a: 1 }
      });
    });

    it("409 → conflito; 404 → null; 503 → transitório", async () => {
      const req = jest.spyOn(axios, "request");
      const gw = await getEfiPixChargeGateway();
      req.mockRejectedValueOnce({ response: { status: 409, data: { nome: "txid_duplicado" } } });
      expect(await gw.putCharge("t", {} as any).catch(e => e)).toMatchObject({ message: "ERR_EFI_PIX_TXID_CONFLICT" });
      req.mockRejectedValueOnce({ response: { status: 404, data: { nome: "cobranca_nao_encontrada" } } });
      await expect(gw.getCharge("t")).resolves.toBeNull();
      req.mockRejectedValueOnce({ response: { status: 503, data: {} } });
      const err = await gw.getCharge("t").catch(e => e);
      expect(err.message).toBe("ERR_EFI_PIX_UNAVAILABLE");
      expect(isEfiPixRetryable(err)).toBe(true);
    });

    it("cadastro de webhook envia o mesmo x-skip-mtls-checking do SDK", async () => {
      const req = jest.spyOn(axios, "request").mockResolvedValue({ status: 200, data: {} } as any);
      const gw = await getEfiPixChargeGateway();
      await gw.putWebhook("chave-db", "https://x.test/w?token=s");
      expect(req.mock.calls[0][0]).toMatchObject({
        method: "PUT",
        url: "https://pix-h.api.efipay.com.br/v2/webhook/chave-db",
        data: { webhookUrl: "https://x.test/w?token=s" },
        headers: expect.objectContaining({ "x-skip-mtls-checking": "true" })
      });
    });
  });
});
