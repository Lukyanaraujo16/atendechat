/**
 * B3.3 — recepção do webhook (unidade): autenticação, forma do corpo, payload mínimo,
 * sanitização de log/Sentry e controles de ativação. Sem banco, sem Redis, sem Efí.
 */
import crypto from "crypto";
import {
  checkWebhookRateLimit,
  constantTimeEquals,
  matchWebhookToken,
  parseWebhookBody,
  resetWebhookRateLimitForTests,
  webhookIpAllowlist,
  WEBHOOK_MAX_ITEMS,
  WEBHOOK_RATE_LIMIT_PER_MINUTE
} from "../webhookReception";
import {
  isSubscriptionWebhookPath,
  safeRequestPath,
  scrubWebhookSentryEvent
} from "../../../helpers/webhookLogSanitizer";
import {
  EFI_RELEASED_RUNTIMES,
  isEfiFeatureReleased,
  isRuntimeReleased,
  isEfiPixReconciliationSweepActive,
  isEfiWebhookPipelineAsyncActive
} from "../efiFinancialSource";
import { backoffMinutes, GATEWAY_WEBHOOK_MAX_ATTEMPTS } from "../processGatewayWebhookEvent";
import { buildSubscriptionWebhookUrlV2 } from "../subscriptionWebhookUrl";

const SECRET = "s".repeat(40);
const req = (query: Record<string, unknown>, headers: Record<string, string> = {}) =>
  ({ query, headers } as any);

const pixItem = (over: Record<string, unknown> = {}) => ({
  endToEndId: "E12345678202610211200abcdefghijk",
  txid: "shc0000000001000000000112345678",
  chave: "chave-da-plataforma@example.test",
  valor: "100.00",
  horario: "2026-10-21T12:00:00.000Z",
  infoPagador: "pagamento",
  gnExtras: { pagador: { nome: "Fulano de Tal", cpf: "12345678909" } },
  ...over
});

describe("B3.3 — autenticação do webhook", () => {
  it("T-WH-01: whToken novo (com ignorar=, o /pix cai no parâmetro descartado) é aceito", () => {
    expect(matchWebhookToken(req({ whToken: SECRET, ignorar: "/pix" }), SECRET) !== null).toBe(true);
  });

  it("T-WH-01b: whToken sem ignorar= recebe o /pix no fim e ainda é aceito", () => {
    expect(matchWebhookToken(req({ whToken: `${SECRET}/pix` }), SECRET) !== null).toBe(true);
  });

  it("T-WH-02/T-WH-16: token legado e token=<secret>/pix aceitos (transição)", () => {
    expect(matchWebhookToken(req({ token: SECRET }), SECRET) !== null).toBe(true);
    expect(matchWebhookToken(req({ token: `${SECRET}/pix` }), SECRET) !== null).toBe(true);
  });

  it("Bearer aceito", () => {
    expect(matchWebhookToken(req({}, { authorization: `Bearer ${SECRET}` }), SECRET) !== null).toBe(true);
  });

  it("T-WH-03: token errado, ausente, prefixo ou secret ausente → recusado", () => {
    expect(matchWebhookToken(req({ whToken: "x".repeat(40) }), SECRET) !== null).toBe(false);
    expect(matchWebhookToken(req({}), SECRET) !== null).toBe(false);
    expect(matchWebhookToken(req({ token: SECRET.slice(0, 39) }), SECRET) !== null).toBe(false);
    expect(matchWebhookToken(req({ token: `${SECRET}/pixx` }), SECRET) !== null).toBe(false);
    expect(matchWebhookToken(req({ token: SECRET }), null) !== null).toBe(false);
    // Parâmetro repetido vira array no Express: nunca é aceito como string.
    expect(matchWebhookToken(req({ token: [SECRET, SECRET] }), SECRET) !== null).toBe(false);
  });

  it("PT-2/PT-5: registra por qual forma o token autenticou (sem o valor)", () => {
    expect(matchWebhookToken(req({ whToken: SECRET, ignorar: "/pix" }), SECRET)).toBe("whToken");
    expect(matchWebhookToken(req({ whToken: `${SECRET}/pix` }), SECRET)).toBe("whToken_pix_suffix");
    expect(matchWebhookToken(req({ token: `${SECRET}/pix` }), SECRET)).toBe("token_pix_suffix");
    expect(matchWebhookToken(req({ token: SECRET }), SECRET)).toBe("token");
    expect(matchWebhookToken(req({}, { authorization: `Bearer ${SECRET}` }), SECRET)).toBe("bearer");
    expect(matchWebhookToken(req({ token: "errado" }), SECRET)).toBeNull();
    expect(matchWebhookToken(req({ token: SECRET }), null)).toBeNull();
  });

  it("T-WH-04: comparação usa crypto.timingSafeEqual", () => {
    const spy = jest.spyOn(crypto, "timingSafeEqual");
    expect(constantTimeEquals(SECRET, SECRET)).toBe(true);
    expect(constantTimeEquals(SECRET, "outro")).toBe(false);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it("T-WH-05: allowlist de IP só vale com TRUST_PROXY_HOPS", () => {
    const env = { ...process.env };
    process.env.EFI_WEBHOOK_IP_ALLOWLIST = "34.193.116.226";
    delete process.env.TRUST_PROXY_HOPS;
    expect(webhookIpAllowlist()).toBeNull();
    process.env.TRUST_PROXY_HOPS = "1";
    expect(webhookIpAllowlist()).toEqual(["34.193.116.226"]);
    process.env = env;
  });

  it("T-SEC-06: rate limit por IP acima do limite; outro IP passa", () => {
    resetWebhookRateLimitForTests();
    const now = 1_000_000;
    for (let i = 0; i < WEBHOOK_RATE_LIMIT_PER_MINUTE; i += 1) expect(checkWebhookRateLimit("1.1.1.1", now)).toBe(true);
    expect(checkWebhookRateLimit("1.1.1.1", now)).toBe(false);
    expect(checkWebhookRateLimit("2.2.2.2", now)).toBe(true);
    expect(checkWebhookRateLimit("1.1.1.1", now + 60001)).toBe(true);
  });
});

describe("B3.3 — forma do corpo e payload mínimo", () => {
  it("T-WH-19: corpo sem estrutura reconhecível → null (400)", () => {
    expect(parseWebhookBody(null)).toBeNull();
    expect(parseWebhookBody("texto")).toBeNull();
    expect(parseWebhookBody([])).toBeNull();
    expect(parseWebhookBody({})).toBeNull();
    expect(parseWebhookBody({ pix: "x" })).toBeNull();
    expect(parseWebhookBody({ pix: [] })).toBeNull();
    expect(parseWebhookBody({ pix: new Array(WEBHOOK_MAX_ITEMS + 1).fill(pixItem()) })).toBeNull();
    // Itens + devoluções acima do teto da transação única.
    const dev = Array.from({ length: 2 }, (_, i) => ({ id: `D${i}`, status: "DEVOLVIDO" }));
    expect(parseWebhookBody({ pix: new Array(WEBHOOK_MAX_ITEMS).fill(pixItem({ devolucoes: dev })) })).toBeNull();
  });

  it("T-WH-06: teste_webhook → evento teste, já classificado ignored_not_saas", () => {
    const [e] = parseWebhookBody({ evento: "teste_webhook", data_criacao: "2026-10-21" })!;
    expect(e.eventType).toBe("teste");
    expect(e.status).toBe("ignored_not_saas");
    expect(e.eventKey).toMatch(/^teste:[0-9a-f]{64}$/);
  });

  it("R-23: pix:<e2eId> com ou sem txid; mesma notificação → mesma chave", () => {
    const a = parseWebhookBody({ pix: [pixItem()] })!;
    const b = parseWebhookBody({ pix: [pixItem({ infoPagador: "outro texto" })] })!;
    expect(a[0].eventKey).toBe("pix:E12345678202610211200abcdefghijk");
    expect(b[0].eventKey).toBe(a[0].eventKey);
    const semTxid = parseWebhookBody({ pix: [pixItem({ txid: undefined })] })!;
    expect(semTxid[0].eventKey).toBe(a[0].eventKey);
    expect(semTxid[0].txid).toBeNull();
  });

  it("T-WH-20: item inválido no lote vira invalid_permanent sem derrubar o válido", () => {
    const events = parseWebhookBody({ pix: [{ txid: "abc" }, pixItem(), 42] })!;
    expect(events.map(e => e.status)).toEqual(["invalid_permanent", "received", "invalid_permanent"]);
    expect(events[0].eventKey).toMatch(/^invalido:/);
    expect(events[0].eventKey).not.toBe(events[2].eventKey);
  });

  it("T-WH-17: devolução com o mesmo e2eId gera eventKey distinto por id e status", () => {
    const events = parseWebhookBody({
      pix: [pixItem({ devolucoes: [{ id: "D1", rtrId: "R1", valor: "100.00", status: "EM_PROCESSAMENTO" }] })]
    })!;
    expect(events.map(e => e.eventKey)).toEqual([
      "pix:E12345678202610211200abcdefghijk",
      "devolucao:E12345678202610211200abcdefghijk:D1:EM_PROCESSAMENTO"
    ]);
    const later = parseWebhookBody({ pix: [pixItem({ devolucoes: [{ id: "D1", status: "DEVOLVIDO" }] })] })!;
    expect(later[1].eventKey).toBe("devolucao:E12345678202610211200abcdefghijk:D1:DEVOLVIDO");
  });

  it("T-ASY-19/T-SEC-09: payload sem infoPagador, gnExtras, nome, CPF ou chave em claro", () => {
    const events = parseWebhookBody({ pix: [pixItem()] })!;
    const text = JSON.stringify(events);
    expect(text).not.toMatch(/Fulano|12345678909|infoPagador|gnExtras|pagamento"/);
    expect(text).not.toContain("chave-da-plataforma@example.test");
    expect(events[0].payload).toMatchObject({ chaveMasked: "****test", valor: "100.00" });
    expect(Object.keys(events[0].payload).sort()).toEqual(
      ["chaveHash", "chaveMasked", "devolucoes", "endToEndId", "horario", "tipo", "txid", "txidInvalid", "valor"].sort()
    );
  });

  it("txid com formato inválido é marcado para invalid_permanent no worker", () => {
    const [e] = parseWebhookBody({ pix: [pixItem({ txid: "../../etc" })] })!;
    expect(e.txid).toBeNull();
    expect(e.payload.txidInvalid).toBe(true);
  });
});

describe("B3.3 — sanitização (R-17)", () => {
  it("T-SEC-05: path de log sem query na rota do webhook; outras rotas inalteradas", () => {
    expect(safeRequestPath(`/subscription/webhook?token=${SECRET}/pix`)).toBe("/subscription/webhook");
    expect(safeRequestPath("/tickets?x=1")).toBe("/tickets?x=1");
    expect(isSubscriptionWebhookPath("https://api.exemplo.test/subscription/webhook?whToken=x")).toBe(true);
  });

  it("T-SEC-10: Sentry sem query, Authorization, cookies e corpo na rota do webhook", () => {
    const event = scrubWebhookSentryEvent({
      request: {
        url: `https://api.exemplo.test/subscription/webhook?whToken=${SECRET}&ignorar=`,
        query_string: `whToken=${SECRET}`,
        cookies: { a: "b" },
        data: { pix: [pixItem()] },
        headers: { Authorization: `Bearer ${SECRET}`, "user-agent": "efi" }
      }
    });
    expect(JSON.stringify(event)).not.toContain(SECRET);
    expect(event.request.url).toBe("https://api.exemplo.test/subscription/webhook");
    expect(event.request.headers).toEqual({ "user-agent": "efi" });
    const other = scrubWebhookSentryEvent({ request: { url: "https://x.test/tickets?a=1", data: "d" } });
    expect(other.request.data).toBe("d");
  });
});

describe("B3.3 — controles e retentativas", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it("gates de código desligados: EFI_WEBHOOK_PIPELINE=async sozinho não ativa", () => {
    // Nada liberado em nenhum runtime (B34-T1): TESTE e PRODUÇÃO seguem travados no código.
    expect(EFI_RELEASED_RUNTIMES).toEqual({
      databaseFinancial: [],
      pixChargeV2: [],
      webhookPipeline: [],
      pixReconciliationSweep: []
    });
    expect(Object.isFrozen(EFI_RELEASED_RUNTIMES)).toBe(true);
    process.env.STREAMHUB_RUNTIME_ENV = "test";
    process.env.EFI_WEBHOOK_PIPELINE = "async";
    process.env.EFI_PIX_RECONCILIATION_SWEEP_ENABLED = "true";
    expect(isEfiWebhookPipelineAsyncActive()).toBe(false);
    expect(isEfiPixReconciliationSweepActive()).toBe(false);
  });

  it("T-ASY-12: backoff 1, 5, 15, 60, 360 min e teto de 8 tentativas", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(backoffMinutes)).toEqual([1, 5, 15, 60, 360, 360, 360, 360]);
    expect(GATEWAY_WEBHOOK_MAX_ATTEMPTS).toBe(8);
  });

  it("URL nova: whToken + ignorar= no fim", () => {
    process.env.BACKEND_URL = "https://api.exemplo.test/";
    expect(buildSubscriptionWebhookUrlV2("a b")).toBe(
      "https://api.exemplo.test/subscription/webhook?whToken=a%20b&ignorar="
    );
  });
});

describe("B3.4 — liberação por runtime (B34-T1)", () => {
  it("só o runtime listado libera; runtime ausente nunca libera", () => {
    expect(isRuntimeReleased(["test"], "test")).toBe(true);
    expect(isRuntimeReleased(["test"], "production")).toBe(false);
    expect(isRuntimeReleased(["test", "production"], null)).toBe(false);
    expect(isRuntimeReleased([], "test")).toBe(false);
  });

  it("com as listas do código vazias, nenhum runtime libera nada", () => {
    const env = { ...process.env };
    for (const runtime of ["test", "production", ""]) {
      process.env.STREAMHUB_RUNTIME_ENV = runtime;
      for (const f of ["databaseFinancial", "pixChargeV2", "webhookPipeline", "pixReconciliationSweep"] as const) {
        expect(isEfiFeatureReleased(f)).toBe(false);
      }
    }
    process.env = env;
  });
});

describe("B3.3 — T-REN-06: sem bloqueio nem datas normalizadas", () => {
  it("nenhum módulo da B3.3 lê BILLING_AUTOMATION_NORMALIZED_DATES ou o job de bloqueio", () => {
    const fs = require("fs");
    const path = require("path");
    const root = path.join(__dirname, "../../..");
    const files = [
      "services/SaasBilling/webhookReception.ts",
      "services/SaasBilling/processGatewayWebhookEvent.ts",
      "services/SaasBilling/gatewayWebhookPipeline.ts",
      "services/SaasBilling/gatewayWebhookAdminService.ts",
      "services/SaasBilling/efiHomologationService.ts",
      "services/SaasBilling/confirmGatewayPayment.ts",
      "libs/gatewayWebhookQueue.ts",
      "controllers/GatewayWebhookAdminController.ts"
    ];
    for (const f of files) {
      const src = fs.readFileSync(path.join(root, f), "utf8");
      expect(src).not.toMatch(/BILLING_AUTOMATION_NORMALIZED_DATES|BillingAutomationJob|billingEvaluation/);
    }
  });
});
