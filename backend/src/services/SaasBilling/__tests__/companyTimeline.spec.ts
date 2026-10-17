/**
 * Fase 8.4-F (F2/C4) — Linha do tempo: merge, ordem, cursor, sem duplicar, isolamento.
 * Os modelos são simulados em memória aplicando companyId/createdAt/limit/offset do `where`.
 */
import { Op } from "sequelize";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: jest.fn() }
}));

const db: any = { companies: [], events: [], logs: [], invoices: [], users: [] };

const lt = (where: any) => where?.createdAt?.[Op.lt] as Date | undefined;
const sortDesc = (rows: any[]) =>
  [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);
const page = (rows: any[], opts: any) =>
  rows.slice(opts.offset || 0, (opts.offset || 0) + (opts.limit ?? rows.length));

jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(async (id: number) => db.companies.find((c: any) => c.id === id) || null) }
}));

jest.mock("../../../models/SaaSFinancialEvent", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(async (opts: any) => {
      const w = opts.where;
      let rows = db.events.filter((e: any) => e.companyId === w.companyId);
      const before = lt(w);
      if (before) rows = rows.filter((e: any) => e.createdAt < before);
      if (w.eventType) rows = rows.filter((e: any) => e.eventType.startsWith("renewal_"));
      if (w.createdAt?.[Op.gte]) {
        rows = rows.filter(
          (e: any) => e.createdAt >= w.createdAt[Op.gte] && e.createdAt <= w.createdAt[Op.lte]
        );
      }
      return page(sortDesc(rows), opts);
    }),
    findOne: jest.fn(async (opts: any) => {
      const rows = db.events
        .filter((e: any) => e.companyId === opts.where.companyId)
        .sort((a: any, b: any) => a.createdAt - b.createdAt);
      return rows[0] || null;
    })
  }
}));

const LOG_ACTIONS = ["block", "unblock", "auto_block", "auto_unblock_after_renew", "due_date_manual_edit", "registration_update"];

jest.mock("../../../models/CompanyLog", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(async (opts: any) => {
      const w = opts.where;
      let rows = db.logs.filter(
        (l: any) =>
          l.companyId === w.companyId &&
          (LOG_ACTIONS.includes(l.action) || l.action.startsWith("renew") || l.action.startsWith("user_"))
      );
      const before = lt(w);
      if (before) rows = rows.filter((l: any) => l.createdAt < before);
      return page(sortDesc(rows), opts);
    })
  }
}));

jest.mock("../../../models/Invoices", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(async (opts: any) => {
      const w = opts.where;
      // Emula o NOT EXISTS (evento invoice_created* da MESMA empresa para a fatura).
      let rows = db.invoices.filter(
        (i: any) =>
          i.companyId === w.companyId &&
          !db.events.some(
            (e: any) =>
              e.invoiceId === i.id && e.companyId === i.companyId && e.eventType.startsWith("invoice_created")
          )
      );
      const before = lt(w);
      if (before) rows = rows.filter((i: any) => i.createdAt < before);
      return page(sortDesc(rows), opts);
    })
  }
}));

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(async (opts: any) =>
      db.users.filter((u: any) => opts.where.id[Op.in].includes(u.id))
    )
  }
}));

import { getCompanyTimeline, mapLedgerEvent, mapCompanyLog } from "../CompanyTimelineService";
import Invoices from "../../../models/Invoices";
import SaaSFinancialEvent from "../../../models/SaaSFinancialEvent";
import CompanyLog from "../../../models/CompanyLog";

const t = (iso: string) => new Date(iso);

function seed() {
  db.companies = [{ id: 5, timezone: "America/Sao_Paulo" }, { id: 6, timezone: "America/Sao_Paulo" }];
  db.users = [{ id: 1, name: "Alex" }];
  db.events = [
    { id: 1, companyId: 5, invoiceId: 20, paymentId: null, eventType: "invoice_created_manual", actorUserId: 1, payload: { value: 100 }, createdAt: t("2026-10-01T10:00:00.000Z") },
    { id: 2, companyId: 5, invoiceId: 20, paymentId: 7, eventType: "manual_payment_recorded", actorUserId: 1, payload: { amount: 100 }, createdAt: t("2026-10-02T10:00:00.000Z") },
    // Renovação no ledger (mesmo ms do pagamento seguinte para testar empates).
    { id: 3, companyId: 5, invoiceId: 20, paymentId: 7, eventType: "renewal_payment_confirmed", actorUserId: 1, payload: { newDueDate: "2026-11-05" }, createdAt: t("2026-10-02T10:00:00.500Z") },
    { id: 4, companyId: 5, invoiceId: null, paymentId: null, eventType: "renewal_manual_renew", actorUserId: 1, payload: { newDueDate: "2026-12-05" }, createdAt: t("2026-10-05T10:00:00.000Z") },
    { id: 5, companyId: 5, invoiceId: 21, paymentId: 8, eventType: "historical_payment_recorded", actorUserId: 1, payload: { amount: 90 }, createdAt: t("2026-10-05T10:00:00.000Z") },
    { id: 6, companyId: 5, invoiceId: 22, paymentId: null, eventType: "gateway_payment_on_settled_invoice", actorUserId: null, payload: { amount: 90 }, createdAt: t("2026-10-06T10:00:00.000Z") },
    // Outra empresa: nunca pode aparecer.
    { id: 99, companyId: 6, invoiceId: 50, paymentId: null, eventType: "manual_payment_recorded", actorUserId: 1, payload: { amount: 5 }, createdAt: t("2026-10-03T10:00:00.000Z") }
  ];
  db.logs = [
    // Duplicata do evento 3 (efeito pós-commit) → omitido.
    { id: 11, companyId: 5, action: "renew_payment_confirmed", userId: 1, metadata: { newDueDate: "2026-11-05" }, createdAt: t("2026-10-02T10:00:01.000Z") },
    // Duplicata do evento 4 → omitido.
    { id: 12, companyId: 5, action: "renew", userId: 1, metadata: { newDueDate: "2026-12-05" }, createdAt: t("2026-10-05T10:00:01.000Z") },
    // Renovação legada sem ledger → exibida.
    { id: 13, companyId: 5, action: "renew", userId: 1, metadata: { newDueDate: "2026-06-05" }, createdAt: t("2026-05-05T10:00:00.000Z") },
    { id: 14, companyId: 5, action: "auto_unblock_after_renew", userId: 1, metadata: {}, createdAt: t("2026-10-02T10:00:01.000Z") },
    { id: 15, companyId: 5, action: "block", userId: 1, metadata: {}, createdAt: t("2026-09-01T10:00:00.000Z") },
    { id: 16, companyId: 5, action: "user_create", userId: 2, metadata: { userId: 40 }, createdAt: t("2026-10-05T10:00:00.000Z") },
    { id: 17, companyId: 6, action: "block", userId: 1, metadata: {}, createdAt: t("2026-10-04T10:00:00.000Z") }
  ];
  db.invoices = [
    { id: 20, companyId: 5, status: "paid", value: 100, dueDate: "2026-10-05", detail: null, legacyUnknown: false, createdAt: t("2026-10-01T10:00:00.000Z") },
    // Legada sem evento de criação → item "inv:".
    { id: 21, companyId: 5, status: "paid", value: 90, dueDate: "2026-04-05", detail: "Antiga", legacyUnknown: true, createdAt: t("2026-04-01T10:00:00.000Z") },
    { id: 50, companyId: 6, status: "open", value: 5, dueDate: "2026-10-05", detail: null, legacyUnknown: false, createdAt: t("2026-04-01T10:00:00.000Z") }
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  seed();
});

describe("getCompanyTimeline", () => {
  it("mescla ledger + logs + faturas sem evento, ordem decrescente, sem duplicar renovações", async () => {
    const r = await getCompanyTimeline(5, { limit: 100 });
    expect(r.items.map(i => i.id)).toEqual([
      "evt:6",
      // Empate no mesmo ms: ledger antes de log; dentro da fonte, id decrescente.
      "evt:5",
      "evt:4",
      "log:16",
      "log:14",
      "evt:3",
      "evt:2",
      "evt:1",
      "log:15",
      "log:13",
      "inv:21"
    ]);
    expect(r.nextBefore).toBeNull();
    expect(r.historyStartsAt).toBe("2026-10-01T10:00:00.000Z");
    const ids = r.items.map(i => i.id);
    expect(ids).not.toContain("log:11");
    expect(ids).not.toContain("log:12");
    expect(ids).not.toContain("inv:20");
  });

  it("mapeia kind/título/valor/ator/fonte", async () => {
    const r = await getCompanyTimeline(5, { limit: 100 });
    const byId = Object.fromEntries(r.items.map(i => [i.id, i]));
    expect(byId["evt:2"]).toMatchObject({
      kind: "payment_manual",
      title: "Pagamento manual registrado (fatura #20)",
      amount: 100,
      actor: { id: 1, name: "Alex" },
      invoiceId: 20,
      source: "ledger"
    });
    expect(byId["evt:3"].kind).toBe("renewal_payment");
    expect(byId["evt:4"].kind).toBe("renewal_admin");
    expect(byId["evt:5"]).toMatchObject({ kind: "payment_historical", amount: 90 });
    expect(byId["evt:6"]).toMatchObject({ kind: "other", actor: null });
    expect(byId["log:13"]).toMatchObject({ kind: "renewal_admin", source: "company_log" });
    expect(byId["log:14"].kind).toBe("unblock_after_renew");
    expect(byId["log:15"].kind).toBe("block_manual");
    // Ator sem usuário encontrado: id preservado, nome genérico (nunca inventa nome).
    expect(byId["log:16"]).toMatchObject({ kind: "user_admin", actor: { id: 2, name: "Usuário #2" } });
    expect(byId["inv:21"]).toMatchObject({
      kind: "invoice_created",
      title: "Fatura registrada (sem histórico detalhado) — fatura #21",
      amount: 90,
      source: "invoice",
      invoiceId: 21
    });
  });

  it("cursor: percorre todas as páginas sem perder nem repetir (inclusive empates no mesmo ms)", async () => {
    const all = (await getCompanyTimeline(5, { limit: 100 })).items.map(i => i.id);
    for (const limit of [1, 2, 3, 4]) {
      const seen: string[] = [];
      let before: string | null | undefined;
      for (let guard = 0; guard < 50; guard++) {
        const r = await getCompanyTimeline(5, { limit, before });
        seen.push(...r.items.map(i => i.id));
        if (!r.nextBefore) break;
        expect(r.items.length).toBeGreaterThan(0);
        before = r.nextBefore;
      }
      expect(seen).toEqual(all);
    }
  });

  it("isolamento: nunca retorna itens de outra empresa; where sempre com companyId", async () => {
    const r = await getCompanyTimeline(6, { limit: 100 });
    expect(r.items.map(i => i.id)).toEqual(["log:17", "evt:99", "inv:50"]);
    for (const m of [SaaSFinancialEvent.findAll, CompanyLog.findAll, Invoices.findAll]) {
      for (const call of (m as jest.Mock).mock.calls) {
        expect(call[0].where.companyId).toBe(6);
      }
    }
    const invWhere = (Invoices.findAll as jest.Mock).mock.calls[0][0].where;
    const sql = invWhere[Op.and][0].val as string;
    expect(sql).toContain("NOT EXISTS");
    expect(sql).toContain(`e."companyId" = "Invoices"."companyId"`);
    expect(sql).toContain("invoice\\_created%");
  });

  it("limit é limitado a 100 (busca 101 para saber se há mais)", async () => {
    await getCompanyTimeline(5, { limit: 5000 });
    expect((SaaSFinancialEvent.findAll as jest.Mock).mock.calls[0][0].limit).toBe(101);
    (SaaSFinancialEvent.findAll as jest.Mock).mockClear();
    await getCompanyTimeline(5, { limit: "abc" });
    expect((SaaSFinancialEvent.findAll as jest.Mock).mock.calls[0][0].limit).toBe(31);
  });

  it("before inválido → 400; empresa inexistente → 404", async () => {
    await expect(getCompanyTimeline(5, { before: "ontem" })).rejects.toMatchObject({
      message: "ERR_INVALID_CURSOR",
      statusCode: 400
    });
    await expect(getCompanyTimeline(777, {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it("empresa sem ledger → historyStartsAt null", async () => {
    db.events = [];
    const r = await getCompanyTimeline(5, { limit: 100 });
    expect(r.historyStartsAt).toBeNull();
    // Sem ledger, os logs de renovação deixam de ser duplicatas e aparecem.
    expect(r.items.map(i => i.id)).toEqual(expect.arrayContaining(["log:11", "log:12", "inv:20"]));
  });
});

describe("mapeamentos", () => {
  it("eventos do ledger", () => {
    expect(mapLedgerEvent("payment_confirmed_gateway", 1, { amount: "10.5" })).toMatchObject({ kind: "payment_gateway", amount: 10.5 });
    expect(mapLedgerEvent("courtesy_granted", 1, null).kind).toBe("courtesy");
    expect(mapLedgerEvent("historical_courtesy_recorded", 1, null).kind).toBe("courtesy_historical");
    expect(mapLedgerEvent("historical_invoice_cancelled", 1, null).kind).toBe("historical_review");
    expect(mapLedgerEvent("historical_review_kept_pending", 1, null).kind).toBe("historical_review");
    expect(mapLedgerEvent("renewal_skipped_period_already_covered", 1, null).kind).toBe("renewal_skipped");
    expect(mapLedgerEvent("renewal_skipped_courtesy", 1, null).kind).toBe("renewal_skipped");
    expect(mapLedgerEvent("renewal_due_date_adjustment", null, null).kind).toBe("due_date_adjusted");
    expect(mapLedgerEvent("invoice_cancelled", 1, null).kind).toBe("invoice_cancelled");
    expect(mapLedgerEvent("invoice_updated", 1, { after: { value: 80 } })).toMatchObject({ kind: "invoice_updated", amount: 80 });
    expect(mapLedgerEvent("algo_novo", null, null).kind).toBe("other");
  });

  it("logs da empresa", () => {
    expect(mapCompanyLog("auto_block").kind).toBe("block_auto");
    expect(mapCompanyLog("unblock").kind).toBe("unblock");
    expect(mapCompanyLog("due_date_manual_edit").kind).toBe("due_date_manual_edit");
    expect(mapCompanyLog("registration_update").kind).toBe("registration_update");
    expect(mapCompanyLog("user_deactivate").kind).toBe("user_admin");
    expect(mapCompanyLog("renew_courtesy").kind).toBe("renewal_payment");
  });
});
