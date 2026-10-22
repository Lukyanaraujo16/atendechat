/**
 * Integração (Postgres real) — pipeline assíncrono do webhook Pix (B3.3).
 * Efí SEMPRE simulada (gateway em memória); fila Bull simulada em memória (o Redis real fica em
 * gatewayWebhookRedis.it.spec.ts). O pipeline é ligado só no teste (spy de
 * `isEfiWebhookPipelineAsyncActive`); sem os controles de ambiente ele segue desligado (B34-T7).
 */
import "express-async-errors";
import crypto from "crypto";
import path from "path";
import request from "supertest";
import express from "express";
import sequelize from "../database";
import Invoices from "../models/Invoices";
import SaaSPayment from "../models/SaaSPayment";
import SaaSPaymentAttempt from "../models/SaaSPaymentAttempt";
import SaaSReconciliationItem from "../models/SaaSReconciliationItem";
import SaaSSubscriptionRenewal from "../models/SaaSSubscriptionRenewal";
import SaaSGatewayWebhookEvent from "../models/SaaSGatewayWebhookEvent";
import * as efiFinancialSource from "../services/SaasBilling/efiFinancialSource";
import subscriptionRoutes from "../routes/subScriptionRoutes";
import { buildApp } from "./helpers/miniApp";
import { setGatewayWebhookQueueForTests } from "../libs/gatewayWebhookQueue";
import {
  claimGatewayWebhookEvent,
  GATEWAY_WEBHOOK_MAX_ATTEMPTS,
  processGatewayWebhookEvent
} from "../services/SaasBilling/processGatewayWebhookEvent";
import { recoverGatewayWebhookEvents } from "../services/SaasBilling/gatewayWebhookPipeline";
import { confirmGatewayPayment } from "../services/SaasBilling/confirmGatewayPayment";
import { registerManualPayment } from "../services/SaasBilling/registerManualPayment";
import { getCompanyFinanceSummary } from "../services/SaasBilling/ListCompanyFinanceService";
import {
  checkWebhookRateLimit,
  resetWebhookRateLimitForTests,
  WEBHOOK_RATE_LIMIT_PER_MINUTE
} from "../services/SaasBilling/webhookReception";
import { respondWebhookRouteError } from "../helpers/webhookLogSanitizer";
import { logger } from "../utils/logger";
import {
  assertDisposableDatabase,
  countState,
  createCompany,
  createOpenInvoice,
  createUser,
  daysFromToday
} from "./helpers/fixtures";

const mockEmits: Array<{ room: string; event: string }> = [];
jest.mock("../libs/socket", () => ({
  getIO: () => ({
    to: (room: string) => ({ emit: (event: string) => mockEmits.push({ room, event }) })
  })
}));

const SECRET = "it-webhook-secret-0123456789abcdefghijkl";
const PIX_KEY = "chave-pix-it@example.test";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const rnd = (n: number) =>
  crypto.randomBytes(n).toString("hex").replace(/[^a-zA-Z0-9]/g, "").slice(0, n);
const newTxid = () => `shc${rnd(28)}`;
const newE2e = () => `E${rnd(31)}`;

/** Fila Bull em memória: deduplica por jobId como o Bull (job vivo com o mesmo id é ignorado). */
function fakeQueue() {
  const jobs = new Map<string, any>();
  const q = {
    jobs,
    failAdd: false as boolean | "hang",
    add: jest.fn(async (_name: string, data: any, opts: any) => {
      if (q.failAdd === "hang") return new Promise(() => undefined);
      if (q.failAdd) throw new Error("ECONNREFUSED redis");
      if (jobs.has(opts.jobId)) return jobs.get(opts.jobId);
      const job = { id: opts.jobId, data, opts, remove: jest.fn(async () => jobs.delete(opts.jobId)) };
      jobs.set(opts.jobId, job);
      return job;
    }),
    getJobs: jest.fn(async () => [...jobs.values()]),
    getJobCounts: jest.fn(async () => ({ waiting: jobs.size, delayed: 0, active: 0, completed: 0, failed: 0 }))
  };
  return q;
}

/** Efí em memória (consulta de cobrança). */
function fakeEfi() {
  const charges = new Map<string, any>();
  const gw = {
    context: {
      source: "legacy_env" as const,
      configId: null,
      slot: null,
      efiEnvironment: "sandbox" as const,
      configFingerprint: null,
      pixKey: PIX_KEY
    },
    getCharge: jest.fn(async (txid: string) => (charges.has(txid) ? { ...charges.get(txid) } : null)),
    putCharge: jest.fn(),
    qrCode: jest.fn(),
    putWebhook: jest.fn(),
    getWebhook: jest.fn()
  };
  return { gw, charges };
}

describe("Pipeline assíncrono do webhook Pix (Postgres real, Efí e fila simuladas)", () => {
  const app = buildApp([subscriptionRoutes]);
  const originalEnv = { ...process.env };
  let efi: ReturnType<typeof fakeEfi>;
  let queue: ReturnType<typeof fakeQueue>;
  let asyncSpy: jest.SpyInstance;

  const post = (body: unknown, query = `?whToken=${SECRET}&ignorar=/pix`) =>
    request(app).post(`/subscription/webhook${query}`).send(body as any);
  const pixItem = (txid: string | undefined, e2e: string, valor = "100.00", extra: Record<string, unknown> = {}) => ({
    endToEndId: e2e,
    txid,
    chave: PIX_KEY,
    valor,
    horario: new Date().toISOString(),
    infoPagador: "pagamento",
    gnExtras: { pagador: { nome: "Pagador Teste", cpf: "12345678909" } },
    ...extra
  });
  const concluded = (txid: string, invoiceId: number | string, e2e: string, valor = "100.00", over: any = {}) =>
    efi.charges.set(txid, {
      txid,
      status: "CONCLUIDA",
      valor: { original: valor },
      chave: PIX_KEY,
      solicitacaoPagador: `#Fatura:${invoiceId}`,
      calendario: { criacao: new Date().toISOString(), expiracao: 3600 },
      pix: [{ endToEndId: e2e, valor, horario: new Date().toISOString() }],
      ...over
    });
  const attemptFor = (invoice: Invoices, txid: string, over: Record<string, unknown> = {}) =>
    SaaSPaymentAttempt.create({
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      method: "pix",
      status: "pending",
      externalTxid: txid,
      gatewayProvider: "efi",
      gatewayStatus: "ATIVA",
      amount: Number(invoice.value),
      payloadSummary: { chargeVersion: 2, source: "legacy_env", efiEnvironment: "sandbox" },
      ...over
    } as any);
  /** Fatura aberta + tentativa + cobrança CONCLUIDA na Efí. */
  async function paidScenario(opts: { value?: number; dueDate?: string } = {}) {
    const company = await createCompany({ dueDate: daysFromToday(-3) });
    const invoice = await createOpenInvoice(company.id, { value: opts.value ?? 100, dueDate: opts.dueDate });
    const txid = newTxid();
    const e2e = newE2e();
    await attemptFor(invoice, txid);
    concluded(txid, invoice.id, e2e, (opts.value ?? 100).toFixed(2));
    return { company, invoice, txid, e2e };
  }
  const eventByKey = (key: string) => SaaSGatewayWebhookEvent.findOne({ where: { eventKey: key } });
  const run = (id: number, workerId = "w-it") => processGatewayWebhookEvent(id, { gateway: efi.gw as any, workerId });
  async function receiveAndProcess(body: unknown): Promise<SaaSGatewayWebhookEvent[]> {
    const res = await post(body);
    expect(res.status).toBe(200);
    const events = await SaaSGatewayWebhookEvent.findAll({ where: { status: "received" }, order: [["id", "ASC"]] });
    for (const e of events) await run(e.id);
    return Promise.all(events.map(e => e.reload()));
  }

  let superUserId: number;
  beforeAll(async () => {
    await assertDisposableDatabase();
    const host = await createCompany({ dueDate: daysFromToday(365) });
    superUserId = (await createUser({ companyId: host.id, superUser: true })).id;
  });

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      WEBHOOK_SUBSCRIPTION_SECRET: SECRET,
      STREAMHUB_RUNTIME_ENV: "test",
      SAAS_BILLING_AUTO_RENEW_ON_PAYMENT: "true"
    };
    jest.restoreAllMocks();
    mockEmits.length = 0;
    resetWebhookRateLimitForTests();
    efi = fakeEfi();
    queue = fakeQueue();
    setGatewayWebhookQueueForTests(queue as any);
    asyncSpy = jest.spyOn(efiFinancialSource, "isEfiWebhookPipelineAsyncActive").mockReturnValue(true);
    // Eventos de testes anteriores não interferem em "pendentes" (recuperação lê o banco todo).
    await SaaSGatewayWebhookEvent.update(
      { status: "ignored_not_saas" } as any,
      { where: { status: ["received", "retry_scheduled", "processing"] } }
    );
  });

  afterAll(async () => {
    process.env = originalEnv;
    setGatewayWebhookQueueForTests(null);
    await sequelize.close();
  });

  describe("controles e migration", () => {
    it("T-ACT-03: após as migrations, pipeline e varredura inativos sem a fonte database efetiva", () => {
      asyncSpy.mockRestore();
      process.env.EFI_WEBHOOK_PIPELINE = "async";
      // Liberação TESTE: "test" na lista, mas a guarda B34-T7 exige EFI_CREDENTIALS_SOURCE=database.
      expect(efiFinancialSource.EFI_RELEASED_RUNTIMES.webhookPipeline).toEqual(["test"]);
      expect(efiFinancialSource.isEfiWebhookPipelineAsyncActive()).toBe(false);
      expect(efiFinancialSource.isEfiPixReconciliationSweepActive()).toBe(false);
    });

    it("T-MIG-01/02: migration idempotente; down recusado com eventos gravados", async () => {
      const mig = require(path.join(__dirname, "../database/migrations/20261021120000-saas-gateway-webhook-events"));
      const qi = sequelize.getQueryInterface();
      await mig.up(qi);
      await mig.up(qi);
      await SaaSGatewayWebhookEvent.create({
        eventKey: `teste:${rnd(20)}`,
        eventType: "teste",
        status: "ignored_not_saas",
        nextAttemptAt: new Date(),
        receivedAt: new Date()
      } as any);
      await expect(mig.down(qi)).rejects.toThrow(/down recusado/);
      expect(await SaaSGatewayWebhookEvent.count()).toBeGreaterThan(0);
    });

    it("T-ACT-06: pipeline legado — token=<secret>/pix rejeitado como hoje, nada persistido; D-P6 não executa", async () => {
      asyncSpy.mockReturnValue(false);
      const before = await SaaSGatewayWebhookEvent.count();
      const res = await post({ pix: [pixItem(newTxid(), newE2e())] }, `?token=${SECRET}/pix`);
      expect(res.status).toBe(401);
      expect(await SaaSGatewayWebhookEvent.count()).toBe(before);
      // Legado (sem o parâmetro do pipeline async): fatura cancelada segue o comportamento da 8.4.
      const company = await createCompany({ dueDate: daysFromToday(-3) });
      const invoice = await createOpenInvoice(company.id);
      await invoice.update({ status: "cancelled" });
      const r = await confirmGatewayPayment({
        invoiceId: invoice.id,
        amount: 100,
        method: "pix",
        externalTxid: newTxid(),
        gatewayProvider: "efi"
      });
      expect(r.cancelledInvoiceReceipt).toBeUndefined();
      expect((await invoice.reload()).status).toBe("paid");
    });

    it("T-RB-04/T-RB-05: async → legacy: URL nova rejeitada pelo legado; eventos persistidos preservados", async () => {
      const s = await paidScenario();
      await post({ pix: [pixItem(s.txid, s.e2e)] });
      const persisted = await SaaSGatewayWebhookEvent.count();
      asyncSpy.mockReturnValue(false);
      const res = await post({ pix: [pixItem(s.txid, s.e2e)] }, `?whToken=${SECRET}&ignorar=/pix`);
      expect(res.status).toBe(401);
      expect(await SaaSGatewayWebhookEvent.count()).toBe(persisted);
      expect(await eventByKey(`pix:${s.e2e}`)).not.toBeNull();
    });
  });

  describe("recepção", () => {
    it("T-WH-01/T-ASY-20/T-NET-07: whToken + ignorar=/pix → 200 'recebido', persistido, sem chamada à Efí, < 5 s", async () => {
      const s = await paidScenario();
      const t0 = Date.now();
      const res = await post({ pix: [pixItem(s.txid, s.e2e)] });
      expect(Date.now() - t0).toBeLessThan(5000);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, received: true });
      expect(efi.gw.getCharge).not.toHaveBeenCalled();
      const e = await eventByKey(`pix:${s.e2e}`);
      expect(e).toMatchObject({ status: "received", txid: s.txid, eventType: "pix", credentialsSource: "legacy_env" });
      expect((e!.payload as any).authVia).toBe("whToken");
      await sleep(50);
      expect(queue.add).toHaveBeenCalledWith(
        "ProcessGatewayWebhookEvent",
        { eventId: e!.id },
        expect.objectContaining({ jobId: `gwe-${e!.id}-0` })
      );
    });

    it("T-WH-02/T-WH-16: token legado e token=<secret>/pix aceitos no async", async () => {
      const a = await post({ pix: [pixItem(newTxid(), newE2e())] }, `?token=${SECRET}`);
      const b = await post({ pix: [pixItem(newTxid(), newE2e())] }, `?token=${SECRET}/pix`);
      expect([a.status, b.status]).toEqual([200, 200]);
    });

    it("T-WH-03: secret errado/ausente → 401 e nada persistido", async () => {
      const before = await SaaSGatewayWebhookEvent.count();
      expect((await post({ pix: [pixItem(newTxid(), newE2e())] }, "?whToken=errado")).status).toBe(401);
      expect((await post({ pix: [pixItem(newTxid(), newE2e())] }, "")).status).toBe(401);
      delete process.env.WEBHOOK_SUBSCRIPTION_SECRET;
      expect((await post({ pix: [pixItem(newTxid(), newE2e())] })).status).toBe(401);
      expect(await SaaSGatewayWebhookEvent.count()).toBe(before);
    });

    it("T-WH-05/T-SEC-11: allowlist com TRUST_PROXY_HOPS usa o IP do cliente; fora → 403, nada persistido", async () => {
      process.env.TRUST_PROXY_HOPS = "1";
      process.env.EFI_WEBHOOK_IP_ALLOWLIST = "34.193.116.226";
      const proxied = express();
      proxied.set("trust proxy", 1);
      proxied.use(app);
      const before = await SaaSGatewayWebhookEvent.count();
      const denied = await request(proxied)
        .post(`/subscription/webhook?whToken=${SECRET}`)
        .set("X-Forwarded-For", "10.0.0.9")
        .send({ pix: [pixItem(newTxid(), newE2e())] });
      expect(denied.status).toBe(403);
      expect(await SaaSGatewayWebhookEvent.count()).toBe(before);
      const ok = await request(proxied)
        .post(`/subscription/webhook?whToken=${SECRET}`)
        .set("X-Forwarded-For", "34.193.116.226")
        .send({ pix: [pixItem(newTxid(), newE2e())] });
      expect(ok.status).toBe(200);
    });

    it("T-SEC-06: rate limit 429 acima do limite", async () => {
      // Só com TRUST_PROXY_HOPS; conta falhas de autenticação. Esgota o balde do IP do supertest.
      process.env.TRUST_PROXY_HOPS = "1";
      expect((await post({ pix: [pixItem(newTxid(), newE2e())] })).status).toBe(200);
      for (let i = 0; i <= WEBHOOK_RATE_LIMIT_PER_MINUTE; i += 1) checkWebhookRateLimit("::ffff:127.0.0.1");
      const e2e = newE2e();
      expect((await post({ pix: [pixItem(newTxid(), e2e)] })).status).toBe(429);
      expect(await eventByKey(`pix:${e2e}`)).toBeNull();
    });

    it("T-WH-19: corpo sem estrutura → 400; JSON inválido → 400 no async (500 no legado), sem query no log", async () => {
      expect((await post({ foo: 1 })).status).toBe(400);
      expect((await post({ pix: "x" })).status).toBe(400);
      const logs: any[] = [];
      jest.spyOn(logger, "error").mockImplementation(((o: any) => logs.push(o)) as any);
      const err = Object.assign(new SyntaxError("Unexpected token"), { type: "entity.parse.failed", body: "{pix" });
      const mk = () => {
        const r: any = { statusCode: 0, body: null };
        r.status = (c: number) => ((r.statusCode = c), r);
        r.json = (b: any) => ((r.body = b), r);
        return r;
      };
      const reqLike = { originalUrl: `/subscription/webhook?whToken=${SECRET}`, url: "" };
      expect(respondWebhookRouteError(err, reqLike as any, mk(), true).statusCode).toBe(400);
      expect(respondWebhookRouteError(err, reqLike as any, mk(), false).statusCode).toBe(500);
      expect(JSON.stringify(logs)).not.toContain(SECRET);
      expect(JSON.stringify(logs)).not.toContain("{pix");
    });

    it("T-ASY-01: a resposta só sai depois do commit (INSERT instrumentado lento)", async () => {
      // Commit lento: a transação só termina 400 ms depois dos INSERTs.
      const original = sequelize.transaction.bind(sequelize) as any;
      jest.spyOn(sequelize, "transaction").mockImplementation(((fn: any) =>
        original(async (t: any) => {
          const r = await fn(t);
          await sleep(400);
          return r;
        })) as any);
      const e2e = newE2e();
      const t0 = Date.now();
      const res = await post({ pix: [pixItem(newTxid(), e2e)] });
      expect(Date.now() - t0).toBeGreaterThanOrEqual(400);
      expect(res.status).toBe(200);
      (sequelize.transaction as jest.Mock).mockRestore();
      expect(await eventByKey(`pix:${e2e}`)).not.toBeNull();
    });

    it("T-ASY-02/T-NET-06: PostgreSQL falha no INSERT → 503, nenhuma linha, nada publicado", async () => {
      jest.spyOn(sequelize, "transaction").mockRejectedValue(new Error("connection refused") as never);
      const e2e = newE2e();
      const res = await post({ pix: [pixItem(newTxid(), e2e)] });
      expect(res.status).toBe(503);
      (sequelize.transaction as jest.Mock).mockRestore();
      expect(await eventByKey(`pix:${e2e}`)).toBeNull();
      await sleep(30);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it("T-ASY-03: falha no meio de um lote de 3 → 503 e nenhuma linha parcial", async () => {
      const original = sequelize.query.bind(sequelize);
      let n = 0;
      jest.spyOn(sequelize, "query").mockImplementation((async (sql: any, opts: any) => {
        if (String(sql).includes('INSERT INTO "SaaSGatewayWebhookEvents"') && ++n === 3) throw new Error("disk full");
        return original(sql, opts);
      }) as any);
      const e2es = [newE2e(), newE2e(), newE2e()];
      const res = await post({ pix: e2es.map(e => pixItem(newTxid(), e)) });
      (sequelize.query as jest.Mock).mockRestore();
      expect(res.status).toBe(503);
      expect(await SaaSGatewayWebhookEvent.count({ where: { endToEndId: e2es } })).toBe(0);
    });

    it("T-ASY-04/T-ASY-05: Redis fora ou publicação travada → 200, evento received, sem exceção", async () => {
      queue.failAdd = true;
      const e1 = newE2e();
      expect((await post({ pix: [pixItem(newTxid(), e1)] })).status).toBe(200);
      queue.failAdd = "hang";
      const e2 = newE2e();
      const t0 = Date.now();
      expect((await post({ pix: [pixItem(newTxid(), e2)] })).status).toBe(200);
      expect(Date.now() - t0).toBeLessThan(1500);
      await sleep(1700);
      expect((await eventByKey(`pix:${e1}`))!.status).toBe("received");
      expect((await eventByKey(`pix:${e2}`))!.status).toBe("received");
    });

    it("T-ASY-09/T-WH-14: mesmo evento 3× → 1 linha, 1 job; T-ASY-21: lote com novos e repetidos", async () => {
      const e2e = newE2e();
      const txid = newTxid();
      for (let i = 0; i < 3; i += 1) expect((await post({ pix: [pixItem(txid, e2e)] })).status).toBe(200);
      await sleep(50);
      expect(await SaaSGatewayWebhookEvent.count({ where: { eventKey: `pix:${e2e}` } })).toBe(1);
      expect(queue.add).toHaveBeenCalledTimes(1);
      const fresh = newE2e();
      await post({ pix: [pixItem(txid, e2e), pixItem(newTxid(), fresh)] });
      await sleep(50);
      expect(queue.add).toHaveBeenCalledTimes(2);
      expect(await SaaSGatewayWebhookEvent.count({ where: { eventKey: `pix:${fresh}` } })).toBe(1);
    });

    it("T-WH-06/T-ASY-31: teste_webhook persistido como teste (ignored_not_saas), sem job", async () => {
      const res = await post({ evento: "teste_webhook", data_criacao: new Date().toISOString() });
      expect(res.status).toBe(200);
      const e = await SaaSGatewayWebhookEvent.findOne({ where: { eventType: "teste" }, order: [["id", "DESC"]] });
      expect(e).toMatchObject({ status: "ignored_not_saas", result: { type: "teste" } });
      await sleep(30);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it("T-ASY-19/T-SEC-09: linha persistida sem dados do pagador, cabeçalhos ou query", async () => {
      const e2e = newE2e();
      await post({ pix: [pixItem(newTxid(), e2e)] });
      const [row] = await sequelize.query(`select * from "SaaSGatewayWebhookEvents" where "eventKey" = :k`, {
        replacements: { k: `pix:${e2e}` }
      });
      const text = JSON.stringify(row);
      expect(text).not.toMatch(/Pagador Teste|12345678909|infoPagador|gnExtras/);
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain(PIX_KEY);
    });
  });

  describe("processamento", () => {
    it("T-WH-07/T-REN-01/T-MT-06: CONCLUIDA + fatura aberta + valor igual → applied, 1 pagamento, 1 renovação", async () => {
      const s = await paidScenario();
      const [e] = await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e)] });
      expect(e.status).toBe("applied");
      expect(e.paymentId).not.toBeNull();
      expect((await s.invoice.reload()).status).toBe("paid");
      const st = await countState(s.company.id);
      expect([st.payments, st.renewals]).toEqual([1, 1]);
      const renewal = await SaaSSubscriptionRenewal.findOne({ where: { companyId: s.company.id } });
      expect(renewal!.idempotencyKey).toBe(`renew-invoice:${s.invoice.id}`);
      expect((await SaaSPaymentAttempt.findOne({ where: { externalTxid: s.txid } }))!.status).toBe("completed");
      expect(mockEmits.filter(m => m.event.endsWith("-payment"))).toEqual([
        { room: `company-${s.company.id}-mainchannel`, event: `company-${s.company.id}-payment` }
      ]);
      expect(e.attemptLog).toHaveLength(1);
      expect(e.attemptLog[0]).toMatchObject({ worker: "w-it", result: "applied" });
    });

    it("T-WH-20: lote com item inválido + Pix válido → válido applied, inválido invalid_permanent", async () => {
      const s = await paidScenario();
      const res = await post({ pix: [{ txid: "abc" }, pixItem(s.txid, s.e2e)] });
      expect(res.status).toBe(200);
      const invalid = await SaaSGatewayWebhookEvent.findOne({
        where: { eventType: "invalido", txid: "abc" },
        order: [["id", "DESC"]]
      });
      expect(invalid!.status).toBe("invalid_permanent");
      const e = await eventByKey(`pix:${s.e2e}`);
      await run(e!.id);
      expect((await e!.reload()).status).toBe("applied");
    });

    it("T-ASY-10/T-ASY-11/T-DUP-02: workers concorrentes no mesmo evento → uma execução", async () => {
      const s = await paidScenario();
      await post({ pix: [pixItem(s.txid, s.e2e)] });
      const e = await eventByKey(`pix:${s.e2e}`);
      const outs = await Promise.all([run(e!.id, "w-a"), run(e!.id, "w-b"), run(e!.id, "w-c")]);
      expect(outs.filter(o => o.outcome === "applied")).toHaveLength(1);
      expect(outs.filter(o => o.outcome === "skipped")).toHaveLength(2);
      const st = await countState(s.company.id);
      expect([st.payments, st.renewals]).toEqual([1, 1]);
    });

    it("T-DUP-01/T-DUP-02: mesmo txid em dois eventos simultâneos → 1 pagamento, 1 renovação", async () => {
      const s = await paidScenario();
      const e2b = newE2e();
      efi.charges.get(s.txid).pix.push({ endToEndId: e2b, valor: "100.00" });
      await post({ pix: [pixItem(s.txid, s.e2e), pixItem(s.txid, e2b)] });
      const a = await eventByKey(`pix:${s.e2e}`);
      const b = await eventByKey(`pix:${e2b}`);
      const outs = await Promise.all([run(a!.id, "w-a"), run(b!.id, "w-b")]);
      expect(outs.map(o => o.outcome).sort()).toEqual(["applied", "replay"]);
      const st = await countState(s.company.id);
      expect([st.payments, st.renewals]).toEqual([1, 1]);
    });

    it("T-WH-08/T-ASY-22: cobrança ATIVA → retry_scheduled com backoff; CONCLUIDA depois → aplica uma vez", async () => {
      const s = await paidScenario();
      efi.charges.get(s.txid).status = "ATIVA";
      await post({ pix: [pixItem(s.txid, s.e2e)] });
      const e = await eventByKey(`pix:${s.e2e}`);
      const out = await run(e!.id);
      expect(out.outcome).toBe("retry_scheduled");
      await e!.reload();
      expect(e!.status).toBe("retry_scheduled");
      const delta = new Date(e!.nextAttemptAt).getTime() - Date.now();
      expect(delta).toBeGreaterThan(50_000);
      expect(delta).toBeLessThan(70_000);
      expect(queue.add).toHaveBeenLastCalledWith(
        "ProcessGatewayWebhookEvent",
        { eventId: e!.id },
        expect.objectContaining({ jobId: `gwe-${e!.id}-1`, delay: 60000 })
      );
      // Antes do vencimento ninguém processa.
      expect((await run(e!.id)).outcome).toBe("skipped");
      efi.charges.get(s.txid).status = "CONCLUIDA";
      await e!.update({ nextAttemptAt: new Date(Date.now() - 1000) });
      expect((await run(e!.id)).outcome).toBe("applied");
      expect((await run(e!.id)).outcome).toBe("skipped");
      expect((await countState(s.company.id)).renewals).toBe(1);
    });

    it("T-ASY-12/T-NET-05/T-WH-13: falha transitória da Efí → retry; lote transitório + ok", async () => {
      const ok = await paidScenario();
      const bad = await paidScenario();
      const original = efi.gw.getCharge.getMockImplementation()!;
      efi.gw.getCharge.mockImplementation(async (txid: string) => {
        if (txid === bad.txid) {
          throw Object.assign(new Error("ERR_EFI_PIX_TIMEOUT"), { data: { retryable: true } });
        }
        return original(txid);
      });
      const events = await receiveAndProcess({ pix: [pixItem(ok.txid, ok.e2e), pixItem(bad.txid, bad.e2e)] });
      expect(events.map(e => e.status)).toEqual(["applied", "retry_scheduled"]);
      expect(events[1].lastError).toMatch(/TIMEOUT/);
      expect((await bad.invoice.reload()).status).toBe("open");
    });

    it("T-ASY-13: retentativas esgotadas → failed_exhausted + conciliação; nunca descartado", async () => {
      const s = await paidScenario();
      efi.gw.getCharge.mockRejectedValue(new Error("ECONNRESET"));
      await post({ pix: [pixItem(s.txid, s.e2e)] });
      const e = await eventByKey(`pix:${s.e2e}`);
      for (let i = 0; i < GATEWAY_WEBHOOK_MAX_ATTEMPTS; i += 1) {
        await e!.update({ nextAttemptAt: new Date(Date.now() - 1000) });
        await run(e!.id);
      }
      await e!.reload();
      expect(e!.status).toBe("failed_exhausted");
      expect(e!.attempts).toBe(GATEWAY_WEBHOOK_MAX_ATTEMPTS);
      const item = await SaaSReconciliationItem.findByPk(e!.reconciliationItemId!);
      expect(item).toMatchObject({ kind: "gateway_webhook_failed_exhausted", companyId: s.company.id });
      expect(e!.attemptLog.length).toBe(GATEWAY_WEBHOOK_MAX_ATTEMPTS);
    });

    it("T-ASY-14/T-SEC-07: txid inexistente na conta (payload forjado) → invalid_permanent, nada aplicado", async () => {
      const s = await paidScenario();
      efi.charges.delete(s.txid);
      const [e] = await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e)] });
      expect(e.status).toBe("invalid_permanent");
      expect((await s.invoice.reload()).status).toBe("open");
      expect((await SaaSReconciliationItem.findByPk(e.reconciliationItemId!))!.kind).toBe("gateway_pix_not_verifiable");
      // Reentrega não reabre: a linha já existe e é terminal.
      await post({ pix: [pixItem(s.txid, s.e2e)] });
      expect((await e.reload()).status).toBe("invalid_permanent");
    });

    it("T-SEC-07b: e2eId que não pertence à cobrança consultada → invalid_permanent", async () => {
      const s = await paidScenario();
      const forged = newE2e();
      const [e] = await receiveAndProcess({ pix: [pixItem(s.txid, forged)] });
      expect(e.status).toBe("invalid_permanent");
      expect((e.result as any).reason).toBe("e2e_not_in_charge");
      expect((await countState(s.company.id)).payments).toBe(0);
    });

    it("T-WH-09: fatura inexistente → reconciliation (registro classificado), nada aplicado", async () => {
      const txid = newTxid();
      const e2e = newE2e();
      concluded(txid, 987654321, e2e);
      const [e] = await receiveAndProcess({ pix: [pixItem(txid, e2e)] });
      expect(e.status).toBe("reconciliation");
      expect((e.result as any).reason).toBe("invoice_not_found");
    });

    it("T-WH-10: valor divergente → reconciliation + item; fatura intacta", async () => {
      const s = await paidScenario();
      concluded(s.txid, s.invoice.id, s.e2e, "90.00");
      const [e] = await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e, "90.00")] });
      expect(e.status).toBe("reconciliation");
      expect((await SaaSReconciliationItem.findByPk(e.reconciliationItemId!))!.kind).toBe("gateway_pix_amount_mismatch");
      expect((await s.invoice.reload()).status).toBe("open");
      expect((await countState(s.company.id)).payments).toBe(0);
    });

    it("T-WH-11: Pix sem txid → unlinked; outra chave → ignored_not_saas; Pix enviado → ignored_not_saas", async () => {
      const a = newE2e();
      const b = newE2e();
      const c = newE2e();
      const events = await receiveAndProcess({
        pix: [
          pixItem(undefined, a),
          pixItem(undefined, b, "10.00", { chave: "outra-chave@example.test" }),
          pixItem(undefined, c, "10.00", { tipo: "SOLICITACAO", status: "REALIZADO" })
        ]
      });
      expect(events.map(e => [e.status, (e.result as any).reason])).toEqual([
        ["unlinked", "pix_without_txid"],
        ["ignored_not_saas", "other_pix_key"],
        ["ignored_not_saas", "not_a_receipt"]
      ]);
      expect(events[0].amount).not.toBeNull();
    });

    it("T-WH-12/T-ORD-03: devolução → conciliação; fatura, receita e renovação intactas; 2º status no mesmo item", async () => {
      const s = await paidScenario();
      await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e)] });
      const before = await countState(s.company.id);
      const dev = (status: string) => pixItem(s.txid, s.e2e, "100.00", {
        devolucoes: [{ id: "DEV1", rtrId: "D123", valor: "100.00", status }]
      });
      const events = await receiveAndProcess({ pix: [dev("EM_PROCESSAMENTO")] });
      expect(events.map(e => [e.eventType, e.status])).toEqual([["devolucao", "reconciliation"]]);
      const item = await SaaSReconciliationItem.findByPk(events[0].reconciliationItemId!);
      expect(item!.kind).toBe("gateway_pix_refund");
      const later = await receiveAndProcess({ pix: [dev("DEVOLVIDO")] });
      expect(later[0].reconciliationItemId).toBe(item!.id);
      expect((await item!.reload()).metadata).toMatchObject({ statusHistory: ["EM_PROCESSAMENTO", "DEVOLVIDO"] });
      expect((await s.invoice.reload()).status).toBe("paid");
      const after = await countState(s.company.id);
      expect([after.payments, after.renewals]).toEqual([before.payments, before.renewals]);
    });

    it("T-ASY-26/SF-3: devolução antes do Pix do mesmo e2eId → Pix em conciliação, sem pagamento nem renovação", async () => {
      const s = await paidScenario();
      // A notificação do Pix original se perdeu; a da devolução chega primeiro e já traz o Pix.
      efi.charges.get(s.txid).pix[0].devolucoes = [{ id: "DEV2", valor: "100.00", status: "DEVOLVIDO" }];
      const events = await receiveAndProcess({
        pix: [pixItem(s.txid, s.e2e, "100.00", { devolucoes: [{ id: "DEV2", valor: "100.00", status: "DEVOLVIDO" }] })]
      });
      const pix = events.find(e => e.eventType === "pix")!;
      expect(pix.status).toBe("reconciliation");
      expect((pix.result as any).reason).toBe("paid_after_refund");
      expect((await SaaSReconciliationItem.findByPk(pix.reconciliationItemId!))!.kind).toBe("gateway_pix_paid_after_refund");
      const st = await countState(s.company.id);
      expect([st.payments, st.renewals]).toEqual([0, 0]);
      expect((await s.invoice.reload()).status).toBe("open");
    });

    it("T-WH-15/T-ASY-23: cobrança anterior à migração (sem tentativa) → fallback #Fatura:, conta env", async () => {
      const company = await createCompany({ dueDate: daysFromToday(-3) });
      const invoice = await createOpenInvoice(company.id);
      const txid = `legacy${rnd(26)}`;
      const e2e = newE2e();
      concluded(txid, invoice.id, e2e);
      const [e] = await receiveAndProcess({ pix: [pixItem(txid, e2e)] });
      expect(e.status).toBe("applied");
      expect(e.result).toMatchObject({ linkedBy: "solicitacaoPagador", chargeSource: "legacy_env" });
    });

    it("T-ASY-24/T-RB-01: cobrança criada pela fonte database, processada com legacy_env (mesma conta)", async () => {
      const s = await paidScenario();
      await SaaSPaymentAttempt.update(
        { payloadSummary: { chargeVersion: 2, source: "database", configId: 7, efiEnvironment: "sandbox" } },
        { where: { externalTxid: s.txid } }
      );
      const [e] = await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e)] });
      expect(e.status).toBe("applied");
      expect(e.result).toMatchObject({ chargeSource: "database", currentSource: "legacy_env" });
      expect((await SaaSPaymentAttempt.findOne({ where: { externalTxid: s.txid } }))!.payloadSummary).toMatchObject({
        source: "database"
      });
    });

    it("T-ORD-01: webhook antes do fim do checkout (tentativa reservada `creating`) → achado pelo txid", async () => {
      const s = await paidScenario();
      await SaaSPaymentAttempt.update({ status: "creating" }, { where: { externalTxid: s.txid } });
      const [e] = await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e)] });
      expect(e.status).toBe("applied");
      expect((e.result as any).linkedBy).toBe("attempt");
    });

    it("T-ASY-25/T-MT-04: aplica só na empresa da fatura", async () => {
      const s = await paidScenario();
      const other = await paidScenario();
      await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e)] });
      expect((await other.invoice.reload()).status).toBe("open");
      expect((await countState(other.company.id)).payments).toBe(0);
    });

    it("T-ASY-27/T-ORD-04/T-DUP-03: Pix de cobrança antiga após outra paga → possível duplicidade, sem renovação", async () => {
      const s = await paidScenario();
      const oldTxid = newTxid();
      const oldE2e = newE2e();
      await attemptFor(s.invoice, oldTxid, { status: "expired" });
      concluded(oldTxid, s.invoice.id, oldE2e);
      await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e)] });
      const [e] = await receiveAndProcess({ pix: [pixItem(oldTxid, oldE2e)] });
      expect(e.status).toBe("reconciliation");
      expect((e.result as any).reason).toBe("invoice_already_settled");
      expect((await SaaSReconciliationItem.findByPk(e.reconciliationItemId!))!.kind).toBe(
        "gateway_payment_on_settled_invoice"
      );
      const st = await countState(s.company.id);
      expect([st.payments, st.renewals]).toEqual([1, 1]);
    });

    it("T-ASY-28/T-DUP-04/T-REN-04: baixa manual com o txid antes do evento → replay + conciliação; 1 renovação", async () => {
      const s = await paidScenario();
      await s.invoice.update({ externalTxid: s.txid, gatewayProvider: "efi" });
      await registerManualPayment({
        invoiceId: s.invoice.id,
        companyId: s.company.id,
        actorUserId: superUserId,
        kind: "paid_offline",
        amount: 100,
        method: "pix_manual",
        paidAt: new Date(),
        reason: "Pix recebido fora do gateway",
        renewSubscription: true
      } as any);
      const [e] = await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e)] });
      expect(e.status).toBe("replay");
      expect((e.result as any).reason).toBe("manual_payment_with_txid");
      const st = await countState(s.company.id);
      expect([st.payments, st.renewals]).toEqual([1, 1]);
    });

    it("T-DUP-05: pagamento histórico e depois o webhook → conciliação, sem receita nova", async () => {
      const s = await paidScenario();
      await SaaSPayment.create({
        companyId: s.company.id,
        invoiceId: s.invoice.id,
        amount: 100,
        method: "pix",
        source: "historical_payment",
        countsAsRevenue: true,
        paidAt: new Date()
      } as any);
      await s.invoice.update({ status: "paid", paymentSource: "historical_payment", paidAt: new Date() });
      const [e] = await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e)] });
      expect(e.status).toBe("reconciliation");
      expect(await SaaSPayment.count({ where: { companyId: s.company.id } })).toBe(1);
    });

    it("T-ASY-29/T-ORD-02/T-REN-05/T-DUP-07 + SF-1: fatura cancelada paga", async () => {
      const s = await paidScenario();
      await s.invoice.update({ status: "cancelled", cancelledAt: new Date() });
      const [e] = await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e)] });
      expect(e.status).toBe("reconciliation");
      expect((e.result as any).reason).toBe("cancelled_invoice_receipt");
      const payment = await SaaSPayment.findByPk(e.paymentId!);
      expect(payment).toMatchObject({ source: "gateway", countsAsRevenue: false, externalTxid: s.txid });
      expect((await s.invoice.reload()).status).toBe("cancelled");
      expect((await countState(s.company.id)).renewals).toBe(0);
      const item = await SaaSReconciliationItem.findByPk(e.reconciliationItemId!);
      expect(item).toMatchObject({ kind: "gateway_payment_on_cancelled_invoice", paymentId: payment!.id });
      expect(mockEmits.filter(m => m.event.endsWith("-payment"))).toHaveLength(0);
      // SF-1: fora da receita consolidada, visível como "recebido em conciliação".
      const summary: any = await getCompanyFinanceSummary(s.company.id);
      expect(summary.totals.received).toBe(0);
      expect(summary.totals.courtesy).toBe(0);
      expect(summary.totals.receivedInReconciliation).toBe(100);
      // Reprocesso do mesmo evento → continua em conciliação, mesmo item, nada novo.
      await e.update({ status: "received", nextAttemptAt: new Date(Date.now() - 1000) });
      expect((await run(e.id)).outcome).toBe("reconciliation");
      expect((await e.reload()).reconciliationItemId).toBe(item!.id);
      expect(await SaaSPayment.count({ where: { invoiceId: s.invoice.id } })).toBe(1);
      // 2º txid para a mesma fatura cancelada → só conciliação de duplicidade.
      const t2 = newTxid();
      const e2 = newE2e();
      await attemptFor(s.invoice, t2);
      concluded(t2, s.invoice.id, e2);
      const [dup] = await receiveAndProcess({ pix: [pixItem(t2, e2)] });
      expect(dup.status).toBe("reconciliation");
      expect((dup.result as any).reason).toBe("cancelled_invoice_duplicate");
      expect(await SaaSPayment.count({ where: { invoiceId: s.invoice.id } })).toBe(1);
      expect((await SaaSReconciliationItem.findByPk(dup.reconciliationItemId!))!.metadata).toMatchObject({
        duplicateOfPaymentId: payment!.id
      });
    });

    it("T-DUP-06/SF-2: cancelada com substituta do mesmo ciclo → substituta intacta, sem renovação, conciliação manual", async () => {
      const s = await paidScenario({ dueDate: daysFromToday(-5) });
      await s.invoice.update({ status: "cancelled", cancelledAt: new Date() });
      const replacement = await createOpenInvoice(s.company.id, { dueDate: daysFromToday(-5) });
      const [e] = await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e)] });
      expect(e.status).toBe("reconciliation");
      expect((await replacement.reload()).status).toBe("open");
      expect((await countState(s.company.id)).renewals).toBe(0);
      const item = await SaaSReconciliationItem.findByPk(e.reconciliationItemId!);
      expect(item!.metadata).toMatchObject({ replacementInvoiceId: replacement.id, requiresManualDecision: true });
      expect(item!.message).toContain(`#${replacement.id}`);
    });

    it("T-DUP-08: cancelada paga + substituta paga → 1 renovação do ciclo", async () => {
      const s = await paidScenario({ dueDate: daysFromToday(-6) });
      await s.invoice.update({ status: "cancelled", cancelledAt: new Date() });
      const replacement = await createOpenInvoice(s.company.id, { dueDate: daysFromToday(-6) });
      const t2 = newTxid();
      const e2 = newE2e();
      await attemptFor(replacement, t2);
      concluded(t2, replacement.id, e2);
      await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e), pixItem(t2, e2)] });
      expect((await replacement.reload()).status).toBe("paid");
      expect((await countState(s.company.id)).renewals).toBe(1);
    });

    it("T-REN-02: SAAS_BILLING_AUTO_RENEW_ON_PAYMENT=false → paga sem renovar", async () => {
      process.env.SAAS_BILLING_AUTO_RENEW_ON_PAYMENT = "false";
      const s = await paidScenario();
      const [e] = await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e)] });
      expect(e.status).toBe("applied");
      expect((await countState(s.company.id)).renewals).toBe(0);
    });

    it("T-REN-03: recorrência inválida → pagamento + conciliação (8.4)", async () => {
      const company = await createCompany({ dueDate: daysFromToday(-3), recurrence: "SEMANAL" });
      const invoice = await createOpenInvoice(company.id);
      const txid = newTxid();
      const e2e = newE2e();
      await attemptFor(invoice, txid);
      concluded(txid, invoice.id, e2e);
      const [e] = await receiveAndProcess({ pix: [pixItem(txid, e2e)] });
      expect(e.status).toBe("applied");
      expect(await SaaSReconciliationItem.count({ where: { companyId: company.id, kind: "gateway_payment_renewal_failed" } })).toBe(1);
    });

    it("T-NET-08: falha ao atualizar a tentativa não perde o pagamento", async () => {
      const s = await paidScenario();
      jest.spyOn(SaaSPaymentAttempt, "update").mockRejectedValue(new Error("db hiccup") as never);
      const [e] = await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e)] });
      expect(e.status).toBe("applied");
      expect((await countState(s.company.id)).payments).toBe(1);
    });

    it("T-SEC-12: log do processamento com ids e sufixos, sem segredo nem pagador", async () => {
      const s = await paidScenario();
      const logs: any[] = [];
      jest.spyOn(logger, "info").mockImplementation(((o: any) => logs.push(o)) as any);
      await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e)] });
      const processed = logs.find(l => l && l.status === "applied");
      expect(processed).toMatchObject({
        invoiceId: s.invoice.id,
        companyId: s.company.id,
        txidSuffix: s.txid.slice(-6),
        e2eSuffix: s.e2e.slice(-6)
      });
      expect(processed.eventId).toEqual(expect.any(Number));
      const text = JSON.stringify(logs);
      expect(text).not.toContain(SECRET);
      expect(text).not.toMatch(/Pagador Teste|12345678909/);
    });
  });

  describe("recuperação e pausa", () => {
    it("T-ASY-07/T-ASY-15: worker morreu após o claim → lock antigo → retry_scheduled → processado uma vez", async () => {
      const s = await paidScenario();
      await post({ pix: [pixItem(s.txid, s.e2e)] });
      const e = await eventByKey(`pix:${s.e2e}`);
      expect(await claimGatewayWebhookEvent(e!.id, "w-morto")).not.toBeNull();
      await sequelize.query(
        `update "SaaSGatewayWebhookEvents" set "lockedAt" = now() - interval '11 minutes' where id = :id`,
        { replacements: { id: e!.id } }
      );
      const report = await recoverGatewayWebhookEvents();
      expect(report.staleReleased).toBe(1);
      expect((await e!.reload()).status).toBe("retry_scheduled");
      expect((await run(e!.id)).outcome).toBe("applied");
      expect((await countState(s.company.id)).renewals).toBe(1);
    });

    it("T-ASY-08: crash depois de confirmGatewayPayment e antes do resultado → reprocesso cai em replay", async () => {
      const s = await paidScenario();
      await post({ pix: [pixItem(s.txid, s.e2e)] });
      const e = await eventByKey(`pix:${s.e2e}`);
      await claimGatewayWebhookEvent(e!.id, "w-crash");
      await confirmGatewayPayment({
        invoiceId: s.invoice.id,
        amount: 100,
        method: "pix",
        externalTxid: s.txid,
        gatewayProvider: "efi",
        cancelledInvoicePolicy: "receive_for_reconciliation"
      });
      await sequelize.query(
        `update "SaaSGatewayWebhookEvents" set "lockedAt" = now() - interval '11 minutes' where id = :id`,
        { replacements: { id: e!.id } }
      );
      await recoverGatewayWebhookEvents();
      expect((await run(e!.id)).outcome).toBe("replay");
      const st = await countState(s.company.id);
      expect([st.payments, st.renewals]).toEqual([1, 1]);
    });

    it("T-ASY-06/T-ASY-16: Redis volta → recuperação republica cada pendente uma vez; job órfão removido", async () => {
      queue.failAdd = true;
      const a = await paidScenario();
      const b = await paidScenario();
      await post({ pix: [pixItem(a.txid, a.e2e), pixItem(b.txid, b.e2e)] });
      await sleep(50);
      queue.failAdd = false;
      // Job órfão (evento terminal) e job de evento inexistente na fila.
      const done = await SaaSGatewayWebhookEvent.findOne({ where: { status: "applied" } });
      await queue.add("ProcessGatewayWebhookEvent", { eventId: done?.id ?? 1 }, { jobId: "gwe-orfao-a" });
      await queue.add("ProcessGatewayWebhookEvent", { eventId: 999999999 }, { jobId: "gwe-orfao-b" });
      const r1 = await recoverGatewayWebhookEvents();
      expect(r1.republished).toBe(2);
      expect(r1.orphanJobsRemoved).toBe(done ? 2 : 1);
      const r2 = await recoverGatewayWebhookEvents();
      expect(r2.orphanJobsRemoved).toBe(0);
      // Mesmo jobId: a segunda recuperação não duplica job vivo.
      const ea = await eventByKey(`pix:${a.e2e}`);
      expect([...queue.jobs.keys()].filter(k => k.startsWith(`gwe-${ea!.id}-`))).toEqual([`gwe-${ea!.id}-0`]);
      for (const job of [...queue.jobs.values()]) await run(job.data.eventId);
      expect((await a.invoice.reload()).status).toBe("paid");
      expect((await b.invoice.reload()).status).toBe("paid");
      expect((await countState(a.company.id)).renewals).toBe(1);
    });

    it("T-ASY-17/T-RB-03: EFI_WEBHOOK_WORKER_PAUSED → recepção 200, nada processado; ao retomar, processado uma vez", async () => {
      process.env.EFI_WEBHOOK_WORKER_PAUSED = "true";
      const s = await paidScenario();
      expect((await post({ pix: [pixItem(s.txid, s.e2e)] })).status).toBe(200);
      const e = await eventByKey(`pix:${s.e2e}`);
      expect((await run(e!.id)).outcome).toBe("skipped");
      expect((await recoverGatewayWebhookEvents()).skipped).toBe("paused");
      expect((await e!.reload()).status).toBe("received");
      delete process.env.EFI_WEBHOOK_WORKER_PAUSED;
      await recoverGatewayWebhookEvents();
      expect((await run(e!.id)).outcome).toBe("applied");
      expect((await run(e!.id)).outcome).toBe("skipped");
      expect((await countState(s.company.id)).renewals).toBe(1);
    });

    it("T-ASY-30: baixa manual + gateway + reprocesso + republicação → exatamente 1 renovação", async () => {
      const s = await paidScenario();
      await s.invoice.update({ externalTxid: s.txid });
      await registerManualPayment({
        invoiceId: s.invoice.id,
        companyId: s.company.id,
        actorUserId: superUserId,
        kind: "paid_offline",
        amount: 100,
        method: "pix_manual",
        paidAt: new Date(),
        reason: "baixa manual",
        renewSubscription: true
      } as any);
      await receiveAndProcess({ pix: [pixItem(s.txid, s.e2e)] });
      const e = await eventByKey(`pix:${s.e2e}`);
      await e!.update({ status: "received", nextAttemptAt: new Date(Date.now() - 1000) });
      await recoverGatewayWebhookEvents();
      await Promise.all([run(e!.id, "w-1"), run(e!.id, "w-2")]);
      await post({ pix: [pixItem(s.txid, s.e2e)] });
      expect(await SaaSSubscriptionRenewal.count({ where: { companyId: s.company.id } })).toBe(1);
    });
  });
});
