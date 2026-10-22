/**
 * Integração (Postgres real) — cobrança Pix v2 (B3.2).
 * A Efí é SEMPRE simulada (gateway em memória + SDK mockado): nenhuma chamada real.
 * A cobrança v2 é ligada só no teste (spy de `isEfiPixChargeV2Active`); sem os controles de
 * ambiente ela segue desligada (B34-T7).
 */
import "express-async-errors";
import path from "path";
import { QueryInterface } from "sequelize";
import sequelize from "../database";
import Invoices from "../models/Invoices";
import SaaSPaymentAttempt from "../models/SaaSPaymentAttempt";
import SaaSReconciliationItem from "../models/SaaSReconciliationItem";
import PlatformEfiConfigAudit from "../models/PlatformEfiConfigAudit";
import * as efiFinancialSource from "../services/SaasBilling/efiFinancialSource";
import * as gatewayModule from "../services/SaasBilling/efiPixChargeGateway";
import {
  buildPixV2Txid,
  createOrReusePixChargeV2,
  PIX_V2_TXID_RE
} from "../services/SaasBilling/createOrReusePixCharge";
import {
  getEfiChargeForAdmin,
  registerEfiWebhookForAdmin
} from "../services/SaasBilling/efiPixAdminService";
import { registerManualPayment } from "../services/SaasBilling/registerManualPayment";
import { getEfiActivationControls } from "../config/saasBillingFlags";
import request from "supertest";
import saasFinanceRoutes from "../routes/saasFinanceRoutes";
import { buildApp, tokenFor } from "./helpers/miniApp";
import {
  assertDisposableDatabase,
  catchError,
  createCompany,
  createOpenInvoice,
  createUser,
  daysFromToday
} from "./helpers/fixtures";

const mockSdk = {
  pixCreateImmediateCharge: jest.fn(),
  pixGenerateQRCode: jest.fn(),
  pixConfigWebhook: jest.fn(),
  pixDetailCharge: jest.fn()
};
jest.mock("gn-api-sdk-typescript", () => ({ __esModule: true, default: () => mockSdk }));

jest.mock("../services/SaasBilling/efiPixChargeGateway", () => {
  const actual = jest.requireActual("../services/SaasBilling/efiPixChargeGateway");
  return { ...actual, getEfiPixChargeGateway: jest.fn(), getEfiDatabasePixGateway: jest.fn() };
});

const PIX_KEY = "chave-pix-it";
const CTX = {
  source: "legacy_env" as const,
  configId: null,
  slot: null,
  efiEnvironment: "sandbox" as const,
  configFingerprint: null,
  pixKey: PIX_KEY
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const conflict = () =>
  gatewayModule.efiPixOperationError("ERR_EFI_PIX_TXID_CONFLICT", 409, "txid já usado", {
    retryable: false,
    efiNome: "txid_duplicado"
  });
const unavailable = () =>
  gatewayModule.efiPixOperationError("ERR_EFI_PIX_UNAVAILABLE", 502, "Efí 503", {
    retryable: true,
    efiStatus: 503
  });

/** Efí em memória: txid único por conta, como na API real. */
function fakeEfi() {
  const charges = new Map<string, any>();
  const hooks: {
    beforePut?: (txid: string) => Promise<void>;
    afterPut?: (txid: string) => Promise<void>;
    get?: (txid: string) => Promise<any>;
  } = {};
  const gw = {
    context: { ...CTX },
    putCharge: jest.fn(async (txid: string, body: any) => {
      if (hooks.beforePut) await hooks.beforePut(txid);
      if (charges.has(txid)) throw conflict();
      const cob = {
        txid,
        status: "ATIVA",
        valor: { original: body.valor.original },
        chave: body.chave,
        solicitacaoPagador: body.solicitacaoPagador,
        calendario: { criacao: new Date().toISOString(), expiracao: body.calendario.expiracao },
        loc: { id: 7 },
        pixCopiaECola: `00020101PIX${txid}`
      };
      charges.set(txid, cob);
      if (hooks.afterPut) await hooks.afterPut(txid);
      return { ...cob };
    }),
    getCharge: jest.fn(async (txid: string) => {
      if (hooks.get) return hooks.get(txid);
      return charges.has(txid) ? { ...charges.get(txid) } : null;
    }),
    qrCode: jest.fn(async () => ({ qrcode: "qr", imagemQrcode: "img" })),
    putWebhook: jest.fn(async () => undefined),
    getWebhook: jest.fn(async () => null as any)
  };
  return { gw, charges, hooks };
}

describe("Cobrança Pix v2 (Postgres real, Efí simulada)", () => {
  let efi: ReturnType<typeof fakeEfi>;
  let companyId: number;
  let superUserId: number;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    await assertDisposableDatabase();
    const host = await createCompany({ dueDate: daysFromToday(365) });
    superUserId = (await createUser({ companyId: host.id, superUser: true })).id;
  });

  beforeEach(async () => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
    Object.values(mockSdk).forEach(m => m.mockReset());
    efi = fakeEfi();
    (gatewayModule.getEfiPixChargeGateway as jest.Mock).mockImplementation(async () => efi.gw);
    // B34-T12: cadastro do webhook e homologação usam o gateway do slot (bootstrap admin).
    (gatewayModule.getEfiDatabasePixGateway as jest.Mock).mockImplementation(async () => efi.gw);
    jest.spyOn(efiFinancialSource, "isEfiPixChargeV2Active").mockReturnValue(true);
    companyId = (await createCompany({ dueDate: daysFromToday(-3) })).id;
  });

  afterAll(async () => {
    process.env = originalEnv;
    await sequelize.close();
  });

  // Ciclo único por empresa (invoices_company_cycle_unique): um vencimento por fatura.
  let seq = 0;
  const inv = (opts: { value?: number } = {}) =>
    createOpenInvoice(companyId, { ...opts, dueDate: daysFromToday(-(++seq) * 32) });
  const charge = (invoiceId: number, cid = companyId) =>
    createOrReusePixChargeV2({ invoiceId, companyId: cid });
  const attemptsOf = (invoiceId: number) =>
    SaaSPaymentAttempt.findAll({ where: { invoiceId }, order: [["id", "ASC"]] });

  describe("criação e reuso", () => {
    it("T-CHG-01/07/09/11/T-MT-03: cria com txid local; creating→pending; resposta enxuta; fonte gravada", async () => {
      const invoice = await inv({ value: 1234.5 });
      const res = await charge(invoice.id);

      expect(res.txid).toMatch(PIX_V2_TXID_RE);
      expect(Object.keys(res).sort()).toEqual(
        ["calendario", "expiresAt", "expiresInSeconds", "qrcode", "reused", "status", "txid", "valor"].sort()
      );
      expect(res).toMatchObject({ status: "ATIVA", valor: { original: "1234.50" }, reused: false });
      expect(res.qrcode.qrcode).toContain(res.txid);
      expect(JSON.stringify(res)).not.toMatch(/chave|loc|solicitacao/);

      const [attempt] = await attemptsOf(invoice.id);
      expect(attempt).toMatchObject({
        status: "pending",
        externalTxid: res.txid,
        companyId,
        method: "pix",
        gatewayStatus: "ATIVA"
      });
      expect(attempt.payloadSummary).toMatchObject({
        chargeVersion: "v2",
        source: "legacy_env",
        configId: null,
        slot: null,
        efiEnvironment: "sandbox",
        expiracao: 3600
      });
      expect(Object.keys(attempt.payloadSummary as object)).toEqual(expect.arrayContaining(["commit", "expiresAt"]));
      const body = efi.gw.putCharge.mock.calls[0][1];
      expect(body).toEqual({
        calendario: { expiracao: 3600 },
        valor: { original: "1234.50" },
        chave: PIX_KEY,
        solicitacaoPagador: `#Fatura:${invoice.id}`
      });
      const fresh = await Invoices.findByPk(invoice.id);
      expect(fresh).toMatchObject({ externalTxid: res.txid, gatewayProvider: "efi", gatewaySyncStatus: "pending" });
    });

    it("T-CHG-08: checkout v2 não cadastra webhook", async () => {
      const invoice = await inv();
      await charge(invoice.id);
      expect(efi.gw.putWebhook).not.toHaveBeenCalled();
      expect(mockSdk.pixConfigWebhook).not.toHaveBeenCalled();
    });

    it("T-CHG-02: cobrança ativa conferida é reusada, sem nova criação", async () => {
      const invoice = await inv();
      const first = await charge(invoice.id);
      const second = await charge(invoice.id);
      expect(second.txid).toBe(first.txid);
      expect(second.reused).toBe(true);
      expect(efi.gw.putCharge).toHaveBeenCalledTimes(1);
      expect(await attemptsOf(invoice.id)).toHaveLength(1);
    });

    it("T-CHG-03/T-IDEM-04: cobrança expirada → nova; a antiga fica registrada como expired", async () => {
      const invoice = await inv();
      const first = await charge(invoice.id);
      const [old] = await attemptsOf(invoice.id);
      // Vencida no prazo local (com margem) E no relógio da Efí: GET conclusivo libera nova.
      await old.update({
        payloadSummary: { ...(old.payloadSummary as object), expiresAt: new Date(Date.now() - 10 * 60_000).toISOString() }
      });
      efi.charges.get(first.txid).calendario.criacao = new Date(Date.now() - 70 * 60_000).toISOString();
      const second = await charge(invoice.id);
      expect(efi.gw.getCharge).toHaveBeenCalledWith(first.txid);
      expect(second.txid).not.toBe(first.txid);
      const rows = await attemptsOf(invoice.id);
      expect(rows.map(r => r.status)).toEqual(["expired", "pending"]);
    });

    it("D-P5: tentativa legada sem expiresAt vale 1 h após a criação; recente é conferida e reusada", async () => {
      const legacyCob = (txid: string, invoiceId: number, criacao = new Date()) => ({
        txid,
        status: "ATIVA",
        valor: { original: "100.00" },
        chave: PIX_KEY,
        solicitacaoPagador: `#Fatura:${invoiceId}`,
        calendario: { criacao: criacao.toISOString(), expiracao: 3600 },
        pixCopiaECola: "legacy-copia-e-cola"
      });
      const legacyAttempt = (invoiceId: number, txid: string) =>
        SaaSPaymentAttempt.create({
          companyId, invoiceId, method: "pix", status: "pending",
          externalTxid: txid, gatewayProvider: "efi", amount: 100,
          payloadSummary: { locId: 3, solicitacaoPagador: `#Fatura:${invoiceId}` }
        } as any);

      const recent = await inv();
      const recentTxid = `legacyRecent${Date.now()}000000000000`;
      efi.charges.set(recentTxid, legacyCob(recentTxid, recent.id));
      await legacyAttempt(recent.id, recentTxid);
      const res = await charge(recent.id);
      expect(res).toMatchObject({ txid: recentTxid, reused: true });
      expect(efi.gw.putCharge).not.toHaveBeenCalled();

      const old = await inv();
      const oldTxid = `legacyOld${Date.now()}0000000000000000`;
      efi.charges.set(oldTxid, legacyCob(oldTxid, old.id, new Date(Date.now() - 65 * 60_000)));
      await legacyAttempt(old.id, oldTxid);
      await sequelize.query(
        `UPDATE "SaaSPaymentAttempts" SET "createdAt" = now() - interval '65 minutes' WHERE "externalTxid" = :t`,
        { replacements: { t: oldTxid } }
      );
      efi.gw.getCharge.mockClear();
      const next = await charge(old.id);
      expect(next.txid).not.toBe(oldTxid);
      // Mesmo vencida pelo prazo local, a legada é conferida na Efí antes de ser abandonada.
      expect(efi.gw.getCharge).toHaveBeenCalledWith(oldTxid);
      const rows = await attemptsOf(old.id);
      expect(rows.map(r => r.status)).toEqual(["expired", "pending"]);
    });

    it("cobrança REMOVIDA na Efí → nova cobrança", async () => {
      const invoice = await inv();
      const first = await charge(invoice.id);
      efi.charges.get(first.txid).status = "REMOVIDA_PELO_USUARIO_RECEBEDOR";
      const second = await charge(invoice.id);
      expect(second.txid).not.toBe(first.txid);
    });
  });

  describe("validações (mantidas)", () => {
    it("T-CHG-04/T-CHG-05/T-MT-01: paga/cancelada → 400; outra empresa → 403; nada criado", async () => {
      const paid = await inv();
      await paid.update({ status: "paid" });
      const cancelled = await inv();
      await cancelled.update({ status: "cancelled" });
      const other = await createOpenInvoice((await createCompany({})).id);

      expect(await catchError(charge(paid.id))).toMatchObject({ message: "ERR_INVOICE_ALREADY_PAID", statusCode: 400 });
      expect(await catchError(charge(cancelled.id))).toMatchObject({ message: "ERR_INVOICE_CANCELLED", statusCode: 400 });
      expect(await catchError(charge(other.id))).toMatchObject({ message: "ERR_FORBIDDEN_INVOICE", statusCode: 403 });
      expect(efi.gw.putCharge).not.toHaveBeenCalled();
      expect(await SaaSPaymentAttempt.count({ where: { invoiceId: [paid.id, cancelled.id, other.id] } })).toBe(0);
    });
  });

  describe("concorrência, falhas e recuperação", () => {
    it("T-IDEM-01: 2 checkouts simultâneos → 1 cobrança, mesma resposta", async () => {
      const invoice = await inv();
      efi.hooks.beforePut = () => sleep(300);
      const [a, b] = await Promise.all([charge(invoice.id), charge(invoice.id)]);
      expect(a.txid).toBe(b.txid);
      expect(efi.charges.size).toBe(1);
      expect(await attemptsOf(invoice.id)).toHaveLength(1);
    });

    it("T-CHG-13: criação lenta na Efí não segura o lock da fatura", async () => {
      const invoice = await inv();
      let release: () => void = () => undefined;
      efi.hooks.beforePut = () => new Promise<void>(r => { release = r; });
      const pending = charge(invoice.id);
      await sleep(300); // passo 2 em andamento

      const started = Date.now();
      await sequelize.transaction(async transaction => {
        // NOWAIT: falha na hora se a fatura estivesse travada pelo checkout.
        await sequelize.query(`SELECT id FROM "Invoices" WHERE id = :id FOR UPDATE NOWAIT`, {
          replacements: { id: invoice.id },
          transaction
        });
      });
      expect(Date.now() - started).toBeLessThan(2000);
      release();
      await pending;
    });

    it("T-CHG-15: fatura cancelada durante a chamada Efí → QR não exibido; tentativa registrada", async () => {
      const invoice = await inv();
      efi.hooks.afterPut = async () => {
        await Invoices.update({ status: "cancelled" }, { where: { id: invoice.id } });
      };
      const err = await catchError(charge(invoice.id));
      expect(err).toMatchObject({ message: "ERR_INVOICE_CANCELLED", statusCode: 400 });
      const [attempt] = await attemptsOf(invoice.id);
      expect(attempt.status).toBe("pending");
      expect((attempt.payloadSummary as any).invoiceClosedDuringCheckout).toBe("cancelled");
      const fresh = await Invoices.findByPk(invoice.id);
      expect(fresh?.status).toBe("cancelled");
      expect(fresh?.externalTxid).toBeNull();
    });

    it("T-CHG-15: fatura paga durante a chamada Efí → 400, QR não exibido", async () => {
      const invoice = await inv();
      efi.hooks.afterPut = async () => {
        await Invoices.update({ status: "paid" }, { where: { id: invoice.id } });
      };
      expect(await catchError(charge(invoice.id))).toMatchObject({ message: "ERR_INVOICE_ALREADY_PAID" });
    });

    it("T-NET-03/T-IDEM-02: falha incerta (5xx/timeout) → failed; retry da mesma tentativa reusa o txid", async () => {
      const invoice = await inv();
      // A Efí criou, mas a resposta se perdeu (timeout depois do processamento).
      efi.hooks.afterPut = async () => {
        throw gatewayModule.efiPixOperationError("ERR_EFI_PIX_TIMEOUT", 504, "timeout", { retryable: true });
      };
      expect(await catchError(charge(invoice.id))).toMatchObject({ message: "ERR_EFI_PIX_TIMEOUT", statusCode: 504 });
      let [attempt] = await attemptsOf(invoice.id);
      expect(attempt.status).toBe("failed");
      expect((attempt.payloadSummary as any).outcomeUnknown).toBe(true);
      const txid = attempt.externalTxid;

      efi.hooks.afterPut = undefined;
      const res = await charge(invoice.id);
      expect(res.txid).toBe(txid);
      expect(efi.charges.size).toBe(1);
      [attempt] = await attemptsOf(invoice.id);
      expect(attempt.status).toBe("pending");
      expect(await attemptsOf(invoice.id)).toHaveLength(1);

      // 5xx antes de criar: retry também usa o mesmo txid.
      const inv2 = await inv();
      efi.hooks.beforePut = async () => { throw unavailable(); };
      expect(await catchError(charge(inv2.id))).toMatchObject({ message: "ERR_EFI_PIX_UNAVAILABLE" });
      const failedTxid = (await attemptsOf(inv2.id))[0].externalTxid;
      efi.hooks.beforePut = undefined;
      expect((await charge(inv2.id)).txid).toBe(failedTxid);
    });

    it("T-CHG-14: tentativa creating órfã → GET antes de criar (existe: reusa; não existe: PUT com o mesmo txid)", async () => {
      const inv1 = await inv();
      const a1 = await SaaSPaymentAttempt.create({
        companyId, invoiceId: inv1.id, method: "pix", status: "creating", gatewayProvider: "efi", amount: 100,
        payloadSummary: { chargeVersion: "v2", source: "legacy_env", configId: null }
      } as any);
      const txid1 = buildPixV2Txid(inv1.id, a1.id);
      await a1.update({ externalTxid: txid1 });
      efi.charges.set(txid1, {
        txid: txid1, status: "ATIVA", valor: { original: "100.00" }, chave: PIX_KEY,
        solicitacaoPagador: `#Fatura:${inv1.id}`, calendario: { criacao: new Date().toISOString(), expiracao: 3600 },
        pixCopiaECola: "x"
      });
      expect((await charge(inv1.id)).txid).toBe(txid1);
      expect(efi.gw.getCharge).toHaveBeenCalledWith(txid1);
      expect(efi.gw.putCharge).not.toHaveBeenCalled();

      const inv2 = await inv();
      const a2 = await SaaSPaymentAttempt.create({
        companyId, invoiceId: inv2.id, method: "pix", status: "creating", gatewayProvider: "efi", amount: 100,
        payloadSummary: { chargeVersion: "v2", source: "legacy_env", configId: null }
      } as any);
      const txid2 = buildPixV2Txid(inv2.id, a2.id);
      await a2.update({ externalTxid: txid2 });
      expect((await charge(inv2.id)).txid).toBe(txid2);
      expect(efi.gw.putCharge).toHaveBeenCalledWith(txid2, expect.anything());
    });

    it("recuperação tardia: creating órfã vencida no prazo local, mas ATIVA na Efí → reusa (sem 2ª cobrança)", async () => {
      const invoice = await inv();
      const a = await SaaSPaymentAttempt.create({
        companyId, invoiceId: invoice.id, method: "pix", status: "creating", gatewayProvider: "efi", amount: 100,
        payloadSummary: { chargeVersion: "v2", source: "legacy_env", configId: null, expiresAt: new Date(Date.now() - 10 * 60_000).toISOString() }
      } as any);
      const txid = buildPixV2Txid(invoice.id, a.id);
      await a.update({ externalTxid: txid });
      // O PUT chegou à Efí bem depois da reserva: a cobrança ainda vale.
      efi.charges.set(txid, {
        txid, status: "ATIVA", valor: { original: "100.00" }, chave: PIX_KEY, solicitacaoPagador: `#Fatura:${invoice.id}`,
        calendario: { criacao: new Date(Date.now() - 5 * 60_000).toISOString(), expiracao: 3600 }, pixCopiaECola: "x"
      });
      const res = await charge(invoice.id);
      expect(res.txid).toBe(txid);
      expect(efi.gw.putCharge).not.toHaveBeenCalled();
      const [row] = await attemptsOf(invoice.id);
      expect(row.status).toBe("pending");
      expect(Date.parse((row.payloadSummary as any).expiresAt)).toBeGreaterThan(Date.now() + 50 * 60_000);
    });

    it("PUT com erro de nome desconhecido → resultado incerto: retry usa o mesmo txid", async () => {
      const invoice = await inv();
      efi.hooks.beforePut = async () => {
        throw gatewayModule.efiPixOperationError("ERR_EFI_PIX_REJECTED", 502, "algo", { retryable: false, efiNome: "erro_desconhecido" });
      };
      expect(await catchError(charge(invoice.id))).toMatchObject({ message: "ERR_EFI_PIX_REJECTED" });
      const [a] = await attemptsOf(invoice.id);
      expect(a).toMatchObject({ status: "failed" });
      expect((a.payloadSummary as any).outcomeUnknown).toBe(true);
      efi.hooks.beforePut = undefined;
      expect((await charge(invoice.id)).txid).toBe(a.externalTxid);
    });

    it("T-NET-04: recusa de validação conhecida (chave_invalida) → falha definitiva; próxima tentativa tem txid novo", async () => {
      const invoice = await inv();
      efi.hooks.beforePut = async () => {
        throw gatewayModule.efiPixOperationError("ERR_EFI_PIX_REJECTED", 502, "chave inválida", { retryable: false, efiNome: "chave_invalida" });
      };
      expect(await catchError(charge(invoice.id))).toMatchObject({ message: "ERR_EFI_PIX_REJECTED" });
      const [a] = await attemptsOf(invoice.id);
      expect((a.payloadSummary as any).outcomeUnknown).toBe(false);
      efi.hooks.beforePut = undefined;
      const res = await charge(invoice.id);
      expect(res.txid).not.toBe(a.externalTxid);
    });

    it("concorrência com falha: um pedido falha depois de o outro criar → tentativa não é rebaixada", async () => {
      const invoice = await inv();
      efi.hooks.beforePut = () => sleep(200);
      let gets = 0;
      efi.hooks.get = async (txid: string) => {
        gets += 1;
        if (gets === 1) return null; // 1º GET do pedido B: ainda não existe
        throw gatewayModule.efiPixOperationError("ERR_EFI_PIX_REJECTED", 502, "falha no GET", { retryable: false, efiNome: "erro_x" });
      };
      const results = await Promise.allSettled([charge(invoice.id), charge(invoice.id)]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(efi.charges.size).toBe(1);
      const rows = await attemptsOf(invoice.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("pending");
      efi.hooks.get = undefined;
      efi.gw.putCharge.mockClear();
      const again = await charge(invoice.id);
      expect(again.txid).toBe(rows[0].externalTxid);
      expect(efi.gw.putCharge).not.toHaveBeenCalled();
    });

    it("T-CHG-17: PUT com conflito (409) → GET + comparação", async () => {
      const invoiceA = await inv();
      let firstGet = true;
      efi.hooks.get = async (txid: string) => {
        // 1º GET (recuperação) ainda não vê a cobrança; o PUT acusa conflito; o 2º GET a encontra.
        if (firstGet) { firstGet = false; return null; }
        return efi.charges.get(txid) ?? null;
      };
      const a = await SaaSPaymentAttempt.create({
        companyId, invoiceId: invoiceA.id, method: "pix", status: "creating", gatewayProvider: "efi", amount: 100,
        payloadSummary: { chargeVersion: "v2", source: "legacy_env", configId: null }
      } as any);
      const txid = buildPixV2Txid(invoiceA.id, a.id);
      await a.update({ externalTxid: txid });
      efi.charges.set(txid, {
        txid, status: "ATIVA", valor: { original: "100.00" }, chave: PIX_KEY,
        solicitacaoPagador: `#Fatura:${invoiceA.id}`, calendario: { criacao: new Date().toISOString(), expiracao: 3600 },
        pixCopiaECola: "x"
      });
      const res = await charge(invoiceA.id);
      expect(res.txid).toBe(txid);
      expect(efi.gw.putCharge).toHaveBeenCalledTimes(1);
      expect(efi.gw.getCharge).toHaveBeenCalledTimes(2);

      // Conflito com cobrança que NÃO confere (outro valor) → bloqueado, sem nova cobrança.
      const inv2 = await inv();
      const b = await SaaSPaymentAttempt.create({
        companyId, invoiceId: inv2.id, method: "pix", status: "creating", gatewayProvider: "efi", amount: 100,
        payloadSummary: { chargeVersion: "v2", source: "legacy_env", configId: null }
      } as any);
      const txid2 = buildPixV2Txid(inv2.id, b.id);
      await b.update({ externalTxid: txid2 });
      efi.hooks.get = async (t: string) => (t === txid2 ? { ...efi.charges.get(t) } : null);
      efi.charges.set(txid2, {
        txid: txid2, status: "ATIVA", valor: { original: "999.00" }, chave: PIX_KEY,
        solicitacaoPagador: `#Fatura:${inv2.id}`, calendario: { criacao: new Date().toISOString(), expiracao: 3600 }
      });
      expect(await catchError(charge(inv2.id))).toMatchObject({ message: "ERR_PIX_CHARGE_DIVERGENT", statusCode: 409 });
      // A cobrança divergente continua viva (`blocked`): o 2º checkout também não cria outra.
      efi.gw.putCharge.mockClear();
      expect(await catchError(charge(inv2.id))).toMatchObject({ message: "ERR_PIX_CHARGE_DIVERGENT" });
      expect(efi.gw.putCharge).not.toHaveBeenCalled();
      expect((await attemptsOf(inv2.id)).map(r => r.status)).toEqual(["blocked"]);
    });
  });

  describe("divergências bloqueiam nova cobrança até a expiração (D-P4)", () => {
    const pendingWith = async (mutate: (cob: any) => void) => {
      const invoice = await inv();
      const first = await charge(invoice.id);
      mutate(efi.charges.get(first.txid));
      efi.gw.putCharge.mockClear();
      return { invoice, first };
    };

    it("valor divergente → 409, sem PUT", async () => {
      const { invoice } = await pendingWith(cob => { cob.valor.original = "1.00"; });
      const err = await catchError(charge(invoice.id));
      expect(err).toMatchObject({ message: "ERR_PIX_CHARGE_DIVERGENT", statusCode: 409 });
      expect(err.data.retryAfterSec).toBeGreaterThan(0);
      expect(efi.gw.putCharge).not.toHaveBeenCalled();
    });

    it("chave Pix divergente → 409, sem PUT", async () => {
      const { invoice } = await pendingWith(() => undefined);
      efi.gw.context.pixKey = "outra-chave";
      expect(await catchError(charge(invoice.id))).toMatchObject({ message: "ERR_PIX_CHARGE_DIVERGENT" });
      expect(efi.gw.putCharge).not.toHaveBeenCalled();
    });

    it("credenciais alteradas (fonte/configId da tentativa ≠ atual) → 409, sem chamar a Efí", async () => {
      const { invoice } = await pendingWith(() => undefined);
      efi.gw.context.source = "database" as any;
      (efi.gw.context as any).configId = 9;
      efi.gw.getCharge.mockClear();
      expect(await catchError(charge(invoice.id))).toMatchObject({ message: "ERR_PIX_CHARGE_CREDENTIALS_CHANGED" });
      expect(efi.gw.getCharge).not.toHaveBeenCalled();
      expect(efi.gw.putCharge).not.toHaveBeenCalled();
    });

    it("cobrança já CONCLUIDA na Efí (webhook pendente) → 409 sem nova cobrança, inclusive após o vencimento", async () => {
      const { invoice } = await pendingWith(cob => { cob.status = "CONCLUIDA"; });
      expect(await catchError(charge(invoice.id))).toMatchObject({ message: "ERR_PIX_CHARGE_ALREADY_PAID" });
      const [attempt] = await attemptsOf(invoice.id);
      await attempt.update({
        payloadSummary: { ...(attempt.payloadSummary as object), expiresAt: new Date(Date.now() - 3 * 3600_000).toISOString() }
      });
      expect(await catchError(charge(invoice.id))).toMatchObject({ message: "ERR_PIX_CHARGE_ALREADY_PAID" });
      expect(efi.gw.putCharge).not.toHaveBeenCalled();
      expect(await attemptsOf(invoice.id)).toHaveLength(1);
    });

    it("pago no último instante (vencida localmente, CONCLUIDA na Efí) → nunca cria 2ª cobrança", async () => {
      const { invoice, first } = await pendingWith(() => undefined);
      const [attempt] = await attemptsOf(invoice.id);
      await attempt.update({
        payloadSummary: { ...(attempt.payloadSummary as object), expiresAt: new Date(Date.now() - 10 * 60_000).toISOString() }
      });
      efi.charges.get(first.txid).status = "CONCLUIDA";
      expect(await catchError(charge(invoice.id))).toMatchObject({ message: "ERR_PIX_CHARGE_ALREADY_PAID" });
      expect(efi.gw.putCharge).not.toHaveBeenCalled();
    });

    it("cobrança blocked é liberada só depois de vencer na Efí (GET conclusivo)", async () => {
      const { invoice, first } = await pendingWith(cob => { cob.valor.original = "1.00"; });
      expect(await catchError(charge(invoice.id))).toMatchObject({ message: "ERR_PIX_CHARGE_DIVERGENT" });
      const [attempt] = await attemptsOf(invoice.id);
      expect(attempt.status).toBe("blocked");
      // Venceu no prazo local e no relógio da Efí.
      await attempt.update({
        payloadSummary: { ...(attempt.payloadSummary as object), expiresAt: new Date(Date.now() - 10 * 60_000).toISOString() }
      });
      efi.charges.get(first.txid).calendario.criacao = new Date(Date.now() - 70 * 60_000).toISOString();
      const next = await charge(invoice.id);
      expect(next.txid).not.toBe(first.txid);
      expect((await attemptsOf(invoice.id)).map(r => r.status)).toEqual(["expired", "pending"]);
    });

    it("creating vencida no prazo local e inexistente na Efí → abandonada; nova cobrança", async () => {
      const invoice = await inv();
      const a = await SaaSPaymentAttempt.create({
        companyId, invoiceId: invoice.id, method: "pix", status: "creating", gatewayProvider: "efi", amount: 100,
        payloadSummary: { chargeVersion: "v2", source: "legacy_env", configId: null, expiresAt: new Date(Date.now() - 10 * 60_000).toISOString() }
      } as any);
      const txid = buildPixV2Txid(invoice.id, a.id);
      await a.update({ externalTxid: txid });
      const res = await charge(invoice.id);
      expect(res.txid).not.toBe(txid);
      expect(efi.gw.getCharge).toHaveBeenCalledWith(txid);
      const rows = await attemptsOf(invoice.id);
      expect(rows[0]).toMatchObject({ status: "expired" });
      expect((rows[0].payloadSummary as any).blockedReason).toBe("not_found_after_expiry");
    });

    it("vencida localmente e ATIVA sem calendario na Efí → 409 não verificável (nem reusa, nem abandona)", async () => {
      const { invoice, first } = await pendingWith(cob => { delete cob.calendario; });
      const [attempt] = await attemptsOf(invoice.id);
      await attempt.update({
        payloadSummary: { ...(attempt.payloadSummary as object), expiresAt: new Date(Date.now() - 10 * 60_000).toISOString() }
      });
      expect(await catchError(charge(invoice.id))).toMatchObject({ message: "ERR_PIX_CHARGE_NOT_VERIFIABLE" });
      expect(efi.gw.putCharge).not.toHaveBeenCalled();
      expect((await attemptsOf(invoice.id)).map(r => r.externalTxid)).toEqual([first.txid]);
    });

    it("cobrança pendente que não aparece na conta → 409 não verificável", async () => {
      const { invoice, first } = await pendingWith(() => undefined);
      efi.charges.delete(first.txid);
      expect(await catchError(charge(invoice.id))).toMatchObject({ message: "ERR_PIX_CHARGE_NOT_VERIFIABLE" });
      expect(efi.gw.putCharge).not.toHaveBeenCalled();
    });
  });

  describe("banco", () => {
    it("T-CHG-16: txid repetido em SaaSPaymentAttempts viola o índice único", async () => {
      const invoice = await inv();
      const row = { companyId, invoiceId: invoice.id, method: "pix", status: "pending", externalTxid: `dupTxid${Date.now()}aaaaaaaaaaaaaaa` };
      await SaaSPaymentAttempt.create(row as any);
      const err = await catchError(SaaSPaymentAttempt.create(row as any));
      expect(err?.name).toBe("SequelizeUniqueConstraintError");
    });

    it("T-MIG-01/02: migration idempotente (up 2×); down remove só o índice, sem apagar linhas", async () => {
      const migration = require(path.join(__dirname, "../database/migrations/20261020120000-saas-payment-attempts-txid-unique"));
      const qi: QueryInterface = sequelize.getQueryInterface();
      const before = await SaaSPaymentAttempt.count();
      await migration.up(qi);
      await migration.up(qi);
      await migration.down(qi);
      expect(await SaaSPaymentAttempt.count()).toBe(before);
      const [idx]: any = await sequelize.query(
        `SELECT 1 FROM pg_indexes WHERE indexname = 'saas_payment_attempts_external_txid_unique'`
      );
      expect(idx).toHaveLength(0);
      await migration.up(qi);
      const [idx2]: any = await sequelize.query(
        `SELECT 1 FROM pg_indexes WHERE indexname = 'saas_payment_attempts_external_txid_unique'`
      );
      expect(idx2).toHaveLength(1);
    });

    it("migration recusa (sem alterar dados) quando já há txid repetido", async () => {
      const migration = require(path.join(__dirname, "../database/migrations/20261020120000-saas-payment-attempts-txid-unique"));
      const qi: QueryInterface = sequelize.getQueryInterface();
      await migration.down(qi);
      const invoice = await inv();
      const txid = `dupMig${Date.now()}bbbbbbbbbbbbbbbbbb`;
      await SaaSPaymentAttempt.bulkCreate([
        { companyId, invoiceId: invoice.id, method: "pix", status: "pending", externalTxid: txid },
        { companyId, invoiceId: invoice.id, method: "pix", status: "pending", externalTxid: txid }
      ] as any);
      const err = await catchError(migration.up(qi));
      expect(String(err?.message)).toContain("txid(s) repetidos");
      expect(await SaaSPaymentAttempt.count({ where: { externalTxid: txid } })).toBe(2);
      await SaaSPaymentAttempt.destroy({ where: { externalTxid: txid } });
      await migration.up(qi);
    });

    it("T-ACT-03: com as migrations aplicadas, controles no default e v2 inativa", async () => {
      jest.restoreAllMocks();
      ["EFI_CREDENTIALS_SOURCE", "EFI_PIX_CHARGE_V2_ENABLED", "EFI_WEBHOOK_PIPELINE"].forEach(k => delete process.env[k]);
      expect(getEfiActivationControls()).toMatchObject({
        credentialsSource: "legacy_env",
        pixChargeV2Enabled: false,
        webhookPipeline: "legacy"
      });
      process.env.EFI_PIX_CHARGE_V2_ENABLED = "true";
      expect(efiFinancialSource.isEfiPixChargeV2Active()).toBe(false);
    });
  });

  describe("compatibilidade com o legado", () => {
    const callCheckout = async (invoiceId: number) => {
      const { createSubscription } = require("../controllers/SubscriptionController");
      const res: any = { json: jest.fn((b: unknown) => b), status: jest.fn(() => res) };
      await createSubscription(
        { user: { companyId }, body: { invoiceId, users: "1", connections: "1" } },
        res
      );
      return res.json.mock.calls[0][0];
    };

    it("T-ACT-04: EFI_PIX_CHARGE_V2_ENABLED=true sem liberação de código → checkout legado com pixConfigWebhook", async () => {
      jest.restoreAllMocks(); // sem o spy: gate real (liberação false)
      process.env.EFI_PIX_CHARGE_V2_ENABLED = "true";
      const invoice = await inv();
      mockSdk.pixCreateImmediateCharge.mockResolvedValue({ txid: "efiTxidLegado123", status: "ATIVA", chave: PIX_KEY, loc: { id: 1 } });
      mockSdk.pixGenerateQRCode.mockResolvedValue({ qrcode: "qr", imagemQrcode: "img" });
      mockSdk.pixConfigWebhook.mockResolvedValue({});
      const body = await callCheckout(invoice.id);
      expect(body).toMatchObject({ txid: "efiTxidLegado123", qrcode: { qrcode: "qr" } });
      expect(mockSdk.pixConfigWebhook).toHaveBeenCalledTimes(1);
      expect(efi.gw.putCharge).not.toHaveBeenCalled();
    });

    it("T-CHG-06: EFI_PIX_ENABLED=false → 403 ERR_PIX_DISABLED (mantido), também com v2", async () => {
      process.env.EFI_PIX_ENABLED = "false";
      const invoice = await inv();
      const err = await catchError(callCheckout(invoice.id));
      expect(err).toMatchObject({ message: "ERR_PIX_DISABLED", statusCode: 403 });
      expect(efi.gw.putCharge).not.toHaveBeenCalled();
    });

    it("checkout v2 pelo controller → resposta v2", async () => {
      const invoice = await inv();
      const body = await callCheckout(invoice.id);
      expect(body.txid).toMatch(PIX_V2_TXID_RE);
      expect(mockSdk.pixCreateImmediateCharge).not.toHaveBeenCalled();
      expect(mockSdk.pixConfigWebhook).not.toHaveBeenCalled();
    });

    it("T-RB-02: v2 desligada com cobrança v2 aberta → webhook legado processa pelo #Fatura:", async () => {
      delete process.env.WEBHOOK_SUBSCRIPTION_SECRET;
      const invoice = await inv({ value: 100 });
      const res = await charge(invoice.id);
      jest.restoreAllMocks(); // rollback: v2 desligada

      mockSdk.pixDetailCharge.mockResolvedValue({
        status: "CONCLUIDA",
        solicitacaoPagador: `#Fatura:${invoice.id}`,
        valor: { original: "100.00" }
      });
      const { webhook } = require("../controllers/SubscriptionController");
      const out: any = { statusCode: 200, json: jest.fn(), status: jest.fn((c: number) => { out.statusCode = c; return out; }) };
      await webhook({ query: {}, headers: {}, body: { pix: [{ txid: res.txid, endToEndId: "E2EIT" }] } }, out);
      expect(out.statusCode).toBe(200);
      const fresh = await Invoices.findByPk(invoice.id);
      expect(fresh?.status).toBe("paid");
      const [attempt] = await attemptsOf(invoice.id);
      expect(attempt.status).toBe("completed");
    });

    it("T-REG-03: baixa manual de fatura com cobrança v2 → conciliação manual_pix_no_settle", async () => {
      const invoice = await inv({ value: 100 });
      await charge(invoice.id);
      await registerManualPayment({
        invoiceId: invoice.id,
        companyId,
        actorUserId: superUserId,
        kind: "paid_offline",
        amount: 100,
        method: "pix_manual",
        paidAt: new Date(),
        reason: "Pix recebido fora do gateway",
        renewSubscription: false
      } as any);
      const items = await SaaSReconciliationItem.findAll({ where: { invoiceId: invoice.id } });
      expect(items.map(i => i.kind)).toContain("manual_pix_no_settle");
    });
  });

  describe("Super Admin", () => {
    it("T-MT-02: usuário não-super nas rotas novas → 401 (contrato atual); super → passa", async () => {
      const app = buildApp([saasFinanceRoutes]);
      const tenantAdmin = await createUser({ companyId, profile: "admin" });
      const token = tokenFor({ id: tenantAdmin.id, profile: "admin", companyId });
      const routes: Array<[string, string]> = [
        ["get", "/saas/finance/efi/charges/shc0000000001000000000100000000"],
        ["get", "/saas/finance/efi/webhook"],
        ["post", "/saas/finance/efi/webhook/register"]
      ];
      for (const [method, url] of routes) {
        const r = await (request(app) as any)[method](url).set("Authorization", `Bearer ${token}`).send({ confirm: true });
        expect(r.status).toBe(401);
      }
      expect(efi.gw.getCharge).not.toHaveBeenCalled();
      expect(efi.gw.putWebhook).not.toHaveBeenCalled();

      const superToken = tokenFor({ id: superUserId, profile: "admin", companyId: null as any });
      const ok = await request(app).get("/saas/finance/efi/webhook").set("Authorization", `Bearer ${superToken}`);
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ registered: false, registerAvailable: true, credentialsSource: "legacy_env" });
    });

    it("T-ACT-05: cadastro de webhook com v2 inativa → recusado sem chamar a Efí", async () => {
      jest.restoreAllMocks();
      const err = await catchError(registerEfiWebhookForAdmin({ actorUserId: superUserId, confirm: true }));
      expect(err).toMatchObject({ message: "ERR_EFI_WEBHOOK_REGISTER_REQUIRES_V2", statusCode: 409 });
      expect(gatewayModule.getEfiPixChargeGateway).not.toHaveBeenCalled();
      expect(gatewayModule.getEfiDatabasePixGateway).not.toHaveBeenCalled();
    });

    it("T-CHG-12/T-SEC-08/T-SEC-13: cadastro (v2) auditado com ator; secret mascarado; conferido por GET", async () => {
      process.env.STREAMHUB_RUNTIME_ENV = "test";
      process.env.BACKEND_URL = "https://api.it.test";
      process.env.WEBHOOK_SUBSCRIPTION_SECRET = "s".repeat(40);
      const url = `https://api.it.test/subscription/webhook?token=${"s".repeat(40)}`;
      efi.gw.getWebhook.mockResolvedValue({ webhookUrl: url, chave: PIX_KEY, criacao: new Date().toISOString() });
      const before = await PlatformEfiConfigAudit.count({ where: { action: "webhook_register" } });

      const out = await registerEfiWebhookForAdmin({ actorUserId: superUserId, confirm: true });
      expect(efi.gw.putWebhook).toHaveBeenCalledWith(PIX_KEY, url);
      expect(out).toMatchObject({ registered: true, conferred: true, webhookUrlMasked: "https://api.it.test/subscription/webhook?token=***" });
      expect(JSON.stringify(out)).not.toContain("s".repeat(40));

      const audits = await PlatformEfiConfigAudit.findAll({ where: { action: "webhook_register" }, order: [["id", "DESC"]] });
      expect(audits.length).toBe(before + 1);
      expect(audits[0].actorUserId).toBe(superUserId);
      expect(audits[0].slot).toBe("homologation");
      expect(String(audits[0].diffSummary)).not.toContain("s".repeat(40));
    });

    it("T-CHG-10: consulta de txid devolve dados da Efí e só atualiza gatewayStatus", async () => {
      const invoice = await inv();
      const res = await charge(invoice.id);
      efi.charges.get(res.txid).status = "CONCLUIDA";
      efi.charges.get(res.txid).pix = [{ endToEndId: "E2E1", valor: "100.00", horario: "2026-10-20T12:00:00Z" }];
      const beforeInvoice = await Invoices.findByPk(invoice.id);

      const out = await getEfiChargeForAdmin(res.txid);
      expect(out).toMatchObject({
        txid: res.txid,
        status: "CONCLUIDA",
        pagamentos: [{ endToEndId: "E2E1", valor: "100.00" }],
        local: { invoiceId: invoice.id, companyId }
      });
      const afterInvoice = await Invoices.findByPk(invoice.id);
      expect(afterInvoice?.gatewayStatus).toBe("CONCLUIDA");
      expect(afterInvoice?.status).toBe(beforeInvoice?.status);
      expect(afterInvoice?.value).toEqual(beforeInvoice?.value);
      expect((await attemptsOf(invoice.id))[0].gatewayStatus).toBe("CONCLUIDA");
      expect(await catchError(getEfiChargeForAdmin("../etc"))).toMatchObject({ message: "ERR_PIX_TXID_INVALID" });

      // Fatura já paga não recebe o espelho de status.
      await Invoices.update({ status: "paid", gatewayStatus: "CONCLUIDA" }, { where: { id: invoice.id } });
      efi.charges.get(res.txid).status = "ATIVA";
      await getEfiChargeForAdmin(res.txid);
      expect((await Invoices.findByPk(invoice.id))?.gatewayStatus).toBe("CONCLUIDA");
    });
  });
});
