/**
 * Integração com Bull 4 + Redis REAL (descartável local) + Postgres real — B3.3.
 * Roda só com REDIS_IT_URI (ex.: redis://127.0.0.1:56379); sem ela, a suíte aparece como pulada
 * (nunca como aprovada). Efí sempre simulada.
 *
 * Cobre PT-8 (dedupe de jobId), Redis indisponível na recepção e volta (T-ASY-04/06),
 * reinício do worker (T-ASY-07) e dois workers Bull concorrentes (T-ASY-11).
 */
import "express-async-errors";
import crypto from "crypto";
import BullQueue, { Queue } from "bull";
import request from "supertest";
import sequelize from "../database";
import SaaSPaymentAttempt from "../models/SaaSPaymentAttempt";
import SaaSGatewayWebhookEvent from "../models/SaaSGatewayWebhookEvent";
import * as efiFinancialSource from "../services/SaasBilling/efiFinancialSource";
import subscriptionRoutes from "../routes/subScriptionRoutes";
import { buildApp } from "./helpers/miniApp";
import {
  GATEWAY_WEBHOOK_JOB_NAME,
  publishGatewayWebhookEvent,
  setGatewayWebhookQueueForTests
} from "../libs/gatewayWebhookQueue";
import {
  claimGatewayWebhookEvent,
  processGatewayWebhookEvent
} from "../services/SaasBilling/processGatewayWebhookEvent";
import { recoverGatewayWebhookEvents } from "../services/SaasBilling/gatewayWebhookPipeline";
import { resetWebhookRateLimitForTests } from "../services/SaasBilling/webhookReception";
import {
  assertDisposableDatabase,
  countState,
  createCompany,
  createOpenInvoice,
  daysFromToday
} from "./helpers/fixtures";

jest.mock("../libs/socket", () => ({ getIO: () => ({ to: () => ({ emit: () => undefined }) }) }));

const REDIS = process.env.REDIS_IT_URI || "";
const describeRedis = REDIS ? describe : describe.skip;
const SECRET = "it-webhook-secret-0123456789abcdefghijkl";
const PIX_KEY = "chave-pix-it@example.test";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const rnd = (n: number) => crypto.randomBytes(n).toString("hex").slice(0, n);

async function waitFor(cond: () => Promise<boolean>, ms = 15000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cond()) return;
    await sleep(100);
  }
  throw new Error("timeout esperando condição");
}

describeRedis("Bull 4 + Redis real (B3.3)", () => {
  const app = buildApp([subscriptionRoutes]);
  const originalEnv = { ...process.env };
  const queues: Queue[] = [];
  const charges = new Map<string, any>();
  const gateway: any = {
    context: { source: "legacy_env", configId: null, slot: null, efiEnvironment: "sandbox", configFingerprint: null, pixKey: PIX_KEY },
    getCharge: jest.fn(async (txid: string) => (charges.has(txid) ? { ...charges.get(txid) } : null))
  };
  const newQueue = (name: string, uri = REDIS) => {
    const q = new BullQueue(name, uri, {
      defaultJobOptions: { removeOnComplete: true, removeOnFail: true, attempts: 1 }
    });
    q.on("error", () => undefined);
    queues.push(q);
    return q;
  };
  const worker = (q: Queue, workerId: string, executions: string[]) =>
    q.process(GATEWAY_WEBHOOK_JOB_NAME, 2, async job => {
      const out = await processGatewayWebhookEvent(Number(job.data.eventId), { gateway, workerId });
      if (out.outcome !== "skipped") executions.push(`${workerId}:${out.outcome}`);
      return out;
    });

  async function scenario() {
    const company = await createCompany({ dueDate: daysFromToday(-3) });
    const invoice = await createOpenInvoice(company.id);
    const txid = `shc${rnd(28)}`;
    const e2e = `E${rnd(31)}`;
    await SaaSPaymentAttempt.create({
      companyId: company.id,
      invoiceId: invoice.id,
      method: "pix",
      status: "pending",
      externalTxid: txid,
      amount: 100,
      payloadSummary: { source: "legacy_env" }
    } as any);
    charges.set(txid, {
      txid,
      status: "CONCLUIDA",
      valor: { original: "100.00" },
      chave: PIX_KEY,
      solicitacaoPagador: `#Fatura:${invoice.id}`,
      pix: [{ endToEndId: e2e, valor: "100.00" }]
    });
    return { company, invoice, txid, e2e, body: { pix: [{ endToEndId: e2e, txid, chave: PIX_KEY, valor: "100.00" }] } };
  }
  const post = (body: unknown) =>
    request(app).post(`/subscription/webhook?whToken=${SECRET}&ignorar=/pix`).send(body as any);
  const eventOf = (e2e: string) => SaaSGatewayWebhookEvent.findOne({ where: { eventKey: `pix:${e2e}` } });

  beforeAll(async () => {
    await assertDisposableDatabase();
  });

  beforeEach(async () => {
    process.env = { ...originalEnv, WEBHOOK_SUBSCRIPTION_SECRET: SECRET, STREAMHUB_RUNTIME_ENV: "test" };
    resetWebhookRateLimitForTests();
    jest.spyOn(efiFinancialSource, "isEfiWebhookPipelineAsyncActive").mockReturnValue(true);
    await SaaSGatewayWebhookEvent.update(
      { status: "ignored_not_saas" } as any,
      { where: { status: ["received", "retry_scheduled", "processing"] } }
    );
  });

  afterEach(async () => {
    setGatewayWebhookQueueForTests(null);
    const bounded = (p: Promise<unknown>) => Promise.race([p.catch(() => undefined), sleep(2000)]);
    for (const q of queues.splice(0)) {
      await bounded(q.obliterate({ force: true }));
      await bounded(q.close());
    }
  });

  afterAll(async () => {
    process.env = originalEnv;
    await sequelize.close();
  });

  it("PT-8: Bull 4 deduplica jobId de job vivo; após removeOnComplete o mesmo jobId volta a ser aceito", async () => {
    const q = newQueue(`pt8-${rnd(6)}`);
    await q.add("x", { n: 1 }, { jobId: "gwe-1-0" });
    await q.add("x", { n: 2 }, { jobId: "gwe-1-0" });
    expect(await q.getJobCounts()).toMatchObject({ waiting: 1 });
    expect((await q.getJob("gwe-1-0"))!.data).toEqual({ n: 1 });
    const done: number[] = [];
    q.process("x", async job => {
      done.push(job.data.n);
    });
    await waitFor(async () => done.length === 1);
    await sleep(200);
    expect(await q.getJob("gwe-1-0")).toBeNull();
    await q.add("x", { n: 3 }, { jobId: "gwe-1-0" });
    await waitFor(async () => done.length === 2);
    expect(done).toEqual([1, 3]);
    // Sem removeOnComplete, job concluído com o mesmo id bloqueia nova publicação.
    const kept = newQueue(`pt8k-${rnd(6)}`);
    const runs: number[] = [];
    kept.process("y", async job => {
      runs.push(job.data.n);
    });
    await kept.add("y", { n: 1 }, { jobId: "k", removeOnComplete: false });
    await waitFor(async () => runs.length === 1);
    await kept.add("y", { n: 2 }, { jobId: "k", removeOnComplete: false });
    await sleep(500);
    expect(runs).toEqual([1]);
  });

  it("ponta a ponta: webhook → PostgreSQL → 200 → Bull → worker → applied, 1 renovação", async () => {
    const q = newQueue(`gw-${rnd(6)}`);
    setGatewayWebhookQueueForTests(q as any);
    const executions: string[] = [];
    worker(q, "w-1", executions);
    const s = await scenario();
    expect((await post(s.body)).status).toBe(200);
    await waitFor(async () => (await eventOf(s.e2e))?.status === "applied");
    expect(executions).toEqual(["w-1:applied"]);
    expect((await countState(s.company.id)).renewals).toBe(1);
  });

  it("T-ASY-04/T-ASY-06: Redis indisponível → 200 e received; Redis de volta → recuperação processa uma vez", async () => {
    const down = newQueue(`down-${rnd(6)}`, "redis://127.0.0.1:1");
    setGatewayWebhookQueueForTests(down as any);
    const s = await scenario();
    const t0 = Date.now();
    expect((await post(s.body)).status).toBe(200);
    expect(Date.now() - t0).toBeLessThan(2000);
    await sleep(1700);
    const e = await eventOf(s.e2e);
    expect(e!.status).toBe("received");
    // Redis volta (fila real).
    const up = newQueue(`up-${rnd(6)}`);
    setGatewayWebhookQueueForTests(up as any);
    const executions: string[] = [];
    worker(up, "w-up", executions);
    const report = await recoverGatewayWebhookEvents();
    expect(report.republished).toBeGreaterThanOrEqual(1);
    await recoverGatewayWebhookEvents();
    await waitFor(async () => (await e!.reload()).status === "applied");
    await sleep(500);
    expect(executions).toEqual(["w-up:applied"]);
    expect((await countState(s.company.id)).payments).toBe(1);
  });

  it("T-ASY-07: worker reiniciado após o claim → outro worker recupera pelo lock antigo, uma execução", async () => {
    const s = await scenario();
    const holder = newQueue(`hold-${rnd(6)}`);
    setGatewayWebhookQueueForTests(holder as any);
    await post(s.body);
    const e = await eventOf(s.e2e);
    expect(await claimGatewayWebhookEvent(e!.id, "w-morto")).not.toBeNull();
    await holder.close();
    await sequelize.query(
      `update "SaaSGatewayWebhookEvents" set "lockedAt" = now() - interval '11 minutes' where id = :id`,
      { replacements: { id: e!.id } }
    );
    const restarted = newQueue(holder.name);
    setGatewayWebhookQueueForTests(restarted as any);
    const executions: string[] = [];
    worker(restarted, "w-novo", executions);
    await recoverGatewayWebhookEvents();
    await waitFor(async () => (await e!.reload()).status === "applied");
    expect(executions).toEqual(["w-novo:applied"]);
    expect((await countState(s.company.id)).renewals).toBe(1);
  });

  it("T-ASY-11: dois workers Bull (conexões Redis distintas) + jobs duplicados → uma execução por evento", async () => {
    const name = `multi-${rnd(6)}`;
    const qa = newQueue(name);
    const qb = newQueue(name);
    setGatewayWebhookQueueForTests(qa as any);
    const executions: string[] = [];
    worker(qa, "w-a", executions);
    worker(qb, "w-b", executions);
    const scenarios = await Promise.all([scenario(), scenario(), scenario()]);
    for (const s of scenarios) await post(s.body);
    // Jobs extras para os mesmos eventos (ids de tentativa diferentes): só o claim decide.
    for (const s of scenarios) {
      const e = await eventOf(s.e2e);
      await publishGatewayWebhookEvent(e!.id, 7);
      await qb.add(GATEWAY_WEBHOOK_JOB_NAME, { eventId: e!.id }, { jobId: `gwe-${e!.id}-dup` });
    }
    await waitFor(async () => {
      const rows = await Promise.all(scenarios.map(s => eventOf(s.e2e)));
      return rows.every(r => r!.status === "applied");
    });
    await sleep(800);
    expect(executions.filter(x => x.endsWith(":applied"))).toHaveLength(3);
    for (const s of scenarios) expect((await countState(s.company.id)).renewals).toBe(1);
  });
});
