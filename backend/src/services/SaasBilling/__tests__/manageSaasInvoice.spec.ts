const mockTransaction = jest.fn(async (fn: any) =>
  fn({ LOCK: { UPDATE: "UPDATE" } })
);

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: (fn: any) => mockTransaction(fn) }
}));

const mockCompany: any = {
  id: 5,
  planId: 3,
  recurrence: "MENSAL",
  timezone: "America/Sao_Paulo",
  contractedPlanValue: null,
  dueDate: new Date("2026-11-10T03:00:00.000Z")
};

jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));

jest.mock("../../../models/Plan", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));

jest.mock("../../../models/Invoices", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn() }
}));

jest.mock("../../../models/SaaSPayment", () => ({
  __esModule: true,
  default: { count: jest.fn() }
}));

jest.mock("../../../models/SaaSSubscriptionRenewal", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("../recordFinancialEvent", () => ({
  recordFinancialEvent: jest.fn(async () => null)
}));

jest.mock("../applySubscriptionRenewal", () => ({
  applySubscriptionRenewal: jest.fn(async () => ({
    alreadyApplied: false,
    company: { id: 5 },
    renewal: { id: 44 },
    autoUnblocked: false
  }))
}));

const mockEfi = jest.fn();
jest.mock("../efiCobrancasClient", () => ({
  createEfiBoletoCharge: (...args: any[]) => mockEfi(...args),
  settleEfiCobrancasCharge: (...args: any[]) => mockEfi(...args)
}));

import Company from "../../../models/Company";
import Plan from "../../../models/Plan";
import Invoices from "../../../models/Invoices";
import SaaSPayment from "../../../models/SaaSPayment";
import SaaSSubscriptionRenewal from "../../../models/SaaSSubscriptionRenewal";
import { recordFinancialEvent } from "../recordFinancialEvent";
import { applySubscriptionRenewal } from "../applySubscriptionRenewal";
import {
  adjustCompanyDueDate,
  createManualInvoice,
  updateOpenInvoice
} from "../ManageSaasInvoiceService";

const companyFind = Company.findByPk as jest.Mock;
const planFind = Plan.findByPk as jest.Mock;
const invFindOne = Invoices.findOne as jest.Mock;
const invCreate = Invoices.create as jest.Mock;
const payCount = SaaSPayment.count as jest.Mock;
const ledger = recordFinancialEvent as jest.Mock;

function makeInvoice(overrides: Record<string, unknown> = {}) {
  const inv: any = {
    id: 10,
    companyId: 5,
    status: "open",
    value: 199.9,
    dueDate: "2026-11-10",
    detail: "Plano Pro",
    cycleKey: "2026-11",
    competence: "2026-11",
    externalTxid: null,
    externalChargeId: null,
    legacyUnknown: false,
    ...overrides
  };
  inv.update = jest.fn(async (data: any) => Object.assign(inv, data));
  inv.reload = jest.fn(async () => inv);
  return inv;
}

const baseCreate = {
  companyId: 5,
  actorUserId: 1,
  dueDate: "2026-11-10",
  reason: "Lançamento manual acordado"
};

describe("ManageSaasInvoiceService.createManualInvoice", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    companyFind.mockResolvedValue({ ...mockCompany });
    planFind.mockResolvedValue({ id: 3, name: "Plano Pro", value: "199.90" });
    invFindOne.mockResolvedValue(null);
    invCreate.mockImplementation(async (data: any) => ({ id: 77, ...data }));
  });

  it("cria fatura open com valor do plano, ciclo pela competência e ledger, sem Efí", async () => {
    const invoice: any = await createManualInvoice(baseCreate);

    expect(invCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "open",
        value: 199.9,
        dueDate: "2026-11-10",
        companyId: 5,
        competence: "2026-11",
        cycleKey: "2026-11",
        planIdSnapshot: 3,
        planNameSnapshot: "Plano Pro",
        recurrenceSnapshot: "MENSAL",
        gatewaySyncStatus: "none",
        legacyUnknown: false,
        paymentSource: null
      }),
      expect.anything()
    );
    expect(invoice.id).toBe(77);
    expect(ledger).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "invoice_created_manual",
        actorUserId: 1,
        invoiceId: 77,
        payload: expect.objectContaining({
          reason: "Lançamento manual acordado",
          valueSource: "plan",
          cycleKey: "2026-11"
        })
      })
    );
    expect(mockEfi).not.toHaveBeenCalled();
    // isolamento: lock na empresa do path
    expect(companyFind).toHaveBeenCalledWith(5, expect.objectContaining({ lock: "UPDATE" }));
  });

  it("aceita valor e competência explícitos", async () => {
    await createManualInvoice({
      ...baseCreate,
      value: "250.456",
      competence: "2026-10"
    });
    expect(invCreate).toHaveBeenCalledWith(
      expect.objectContaining({ value: 250.46, competence: "2026-10", cycleKey: "2026-10" }),
      expect.anything()
    );
  });

  it("recusa ciclo duplicado (mesmo cycleKey) com 409 e id da fatura existente", async () => {
    invFindOne.mockResolvedValueOnce({ id: 33, cycleKey: "2026-11" });
    await expect(createManualInvoice(baseCreate)).rejects.toMatchObject({
      message: "ERR_INVOICE_CYCLE_DUPLICATE",
      statusCode: 409,
      clientMessage: expect.stringContaining("#33")
    });
    expect(invCreate).not.toHaveBeenCalled();
  });

  it("recusa duplicidade com fatura legada (cycleKey nulo) no mesmo vencimento", async () => {
    invFindOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 12, cycleKey: null });
    await expect(createManualInvoice(baseCreate)).rejects.toMatchObject({
      message: "ERR_INVOICE_CYCLE_DUPLICATE",
      statusCode: 409
    });
    const legacyWhere = invFindOne.mock.calls[1][0].where;
    expect(legacyWhere.companyId).toBe(5);
    expect(legacyWhere.cycleKey).toBeNull();
  });

  it("converte violação do índice único em 409", async () => {
    invCreate.mockRejectedValueOnce({
      name: "SequelizeUniqueConstraintError",
      parent: { constraint: "invoices_company_cycle_unique" }
    });
    await expect(createManualInvoice(baseCreate)).rejects.toMatchObject({
      message: "ERR_INVOICE_CYCLE_DUPLICATE",
      statusCode: 409
    });
  });

  it.each([0, -10, "abc"])("recusa valor inválido (%p)", async value => {
    await expect(
      createManualInvoice({ ...baseCreate, value: value as any })
    ).rejects.toMatchObject({ message: "ERR_INVALID_INVOICE_VALUE", statusCode: 400 });
    expect(invCreate).not.toHaveBeenCalled();
  });

  it("recusa quando o valor do plano é zero", async () => {
    planFind.mockResolvedValueOnce({ id: 3, name: "Grátis", value: 0 });
    await expect(createManualInvoice(baseCreate)).rejects.toMatchObject({
      message: "ERR_INVALID_INVOICE_VALUE"
    });
  });

  it("exige motivo, vencimento válido e competência YYYY-MM", async () => {
    await expect(
      createManualInvoice({ ...baseCreate, reason: " " })
    ).rejects.toMatchObject({ message: "ERR_INVOICE_REASON_REQUIRED" });
    await expect(
      createManualInvoice({ ...baseCreate, dueDate: "2026-02-30" })
    ).rejects.toMatchObject({ message: "ERR_INVALID_DUE_DATE" });
    await expect(
      createManualInvoice({ ...baseCreate, competence: "2026-13" })
    ).rejects.toMatchObject({ message: "ERR_INVALID_COMPETENCE" });
  });

  it("404 para empresa inexistente", async () => {
    companyFind.mockResolvedValueOnce(null);
    await expect(createManualInvoice(baseCreate)).rejects.toMatchObject({
      message: "ERR_NO_COMPANY_FOUND",
      statusCode: 404
    });
  });
});

describe("ManageSaasInvoiceService.updateOpenInvoice", () => {
  const baseUpdate = {
    companyId: 5,
    invoiceId: 10,
    actorUserId: 2,
    reason: "Correção de valor negociado"
  };

  beforeEach(() => {
    jest.clearAllMocks();
    companyFind.mockResolvedValue({ id: 5, timezone: "America/Sao_Paulo" });
    payCount.mockResolvedValue(0);
  });

  it("bloqueia fatura paga", async () => {
    invFindOne.mockResolvedValueOnce(makeInvoice({ status: "paid" }));
    await expect(
      updateOpenInvoice({ ...baseUpdate, value: 100 })
    ).rejects.toMatchObject({ message: "ERR_INVOICE_NOT_EDITABLE", statusCode: 409 });
  });

  it("bloqueia fatura com pagamento vinculado", async () => {
    invFindOne.mockResolvedValueOnce(makeInvoice());
    payCount.mockResolvedValueOnce(1);
    await expect(
      updateOpenInvoice({ ...baseUpdate, value: 100 })
    ).rejects.toMatchObject({ message: "ERR_INVOICE_NOT_EDITABLE", statusCode: 409 });
  });

  it("bloqueia fatura com cobrança externa ativa", async () => {
    invFindOne.mockResolvedValueOnce(makeInvoice({ externalChargeId: "ch_1" }));
    await expect(
      updateOpenInvoice({ ...baseUpdate, value: 100 })
    ).rejects.toMatchObject({ message: "ERR_INVOICE_NOT_EDITABLE" });
    invFindOne.mockResolvedValueOnce(makeInvoice({ externalTxid: "tx_1" }));
    await expect(
      updateOpenInvoice({ ...baseUpdate, value: 100 })
    ).rejects.toMatchObject({ message: "ERR_INVOICE_NOT_EDITABLE" });
  });

  it("escopo por empresa: fatura de outra empresa → 404", async () => {
    invFindOne.mockResolvedValueOnce(null);
    await expect(
      updateOpenInvoice({ ...baseUpdate, value: 100 })
    ).rejects.toMatchObject({ message: "ERR_INVOICE_NOT_FOUND", statusCode: 404 });
    expect(invFindOne.mock.calls[0][0]).toMatchObject({
      where: { id: 10, companyId: 5 },
      lock: "UPDATE"
    });
  });

  it("registra ledger invoice_updated com before/after e recalcula ciclo", async () => {
    const inv = makeInvoice();
    invFindOne
      .mockResolvedValueOnce(inv) // lock da fatura
      .mockResolvedValueOnce(null) // duplicidade cycleKey
      .mockResolvedValueOnce(null); // duplicidade legado
    await updateOpenInvoice({
      ...baseUpdate,
      value: 150,
      dueDate: "2026-12-05",
      detail: "Plano Pro (ajustado)"
    });

    expect(inv.update).toHaveBeenCalledWith(
      {
        value: 150,
        detail: "Plano Pro (ajustado)",
        dueDate: "2026-12-05",
        cycleKey: "2026-12",
        competence: "2026-12"
      },
      expect.anything()
    );
    expect(ledger).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "invoice_updated",
        actorUserId: 2,
        payload: expect.objectContaining({
          reason: "Correção de valor negociado",
          before: {
            value: 199.9,
            detail: "Plano Pro",
            dueDate: "2026-11-10",
            cycleKey: "2026-11",
            competence: "2026-11"
          },
          after: {
            value: 150,
            detail: "Plano Pro (ajustado)",
            dueDate: "2026-12-05",
            cycleKey: "2026-12",
            competence: "2026-12"
          }
        })
      })
    );
  });

  it("mudança de vencimento para ciclo ocupado → 409 duplicidade", async () => {
    invFindOne
      .mockResolvedValueOnce(makeInvoice())
      .mockResolvedValueOnce({ id: 11, cycleKey: "2026-12" });
    await expect(
      updateOpenInvoice({ ...baseUpdate, dueDate: "2026-12-05" })
    ).rejects.toMatchObject({ message: "ERR_INVOICE_CYCLE_DUPLICATE", statusCode: 409 });
  });

  it("fatura legada (sem cycleKey) muda vencimento sem criar ciclo", async () => {
    const inv = makeInvoice({
      cycleKey: null,
      competence: null,
      dueDate: "2026-11-10T00:00:00-03:00"
    });
    invFindOne.mockResolvedValueOnce(inv);
    await updateOpenInvoice({ ...baseUpdate, dueDate: "2026-11-20" });
    expect(inv.update).toHaveBeenCalledWith({ dueDate: "2026-11-20" }, expect.anything());
    expect(ledger.mock.calls[0][0].payload.before).toEqual({ dueDate: "2026-11-10" });
  });

  it("sem alterações não grava nem registra ledger", async () => {
    const inv = makeInvoice();
    invFindOne.mockResolvedValueOnce(inv);
    await updateOpenInvoice({ ...baseUpdate, value: 199.9, dueDate: "2026-11-10" });
    expect(inv.update).not.toHaveBeenCalled();
    expect(ledger).not.toHaveBeenCalled();
  });
});

describe("ManageSaasInvoiceService.adjustCompanyDueDate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    companyFind.mockResolvedValue({ ...mockCompany });
    (SaaSSubscriptionRenewal.findOne as jest.Mock).mockResolvedValue({ id: 8 });
  });

  it("usa chave determinística com vencimento anterior normalizado (Date → YYYY-MM-DD) e repassa o motivo", async () => {
    await adjustCompanyDueDate({
      companyId: 5,
      actorUserId: 1,
      dueDate: "2026-12-01",
      reason: "  Acordo comercial "
    });
    expect(applySubscriptionRenewal).toHaveBeenCalledWith({
      companyId: 5,
      reason: "due_date_adjustment",
      actorUserId: 1,
      explicitDueDate: "2026-12-01",
      expectedCurrentDueDate: "2026-11-10",
      idempotencyKey: "adj:5:2026-11-10:2026-12-01:r8",
      note: "Acordo comercial"
    });
  });

  it("mesmo vencimento → no-op (clique duplo)", async () => {
    const r = await adjustCompanyDueDate({
      companyId: 5,
      actorUserId: 1,
      dueDate: "2026-11-10",
      reason: "Acordo comercial"
    });
    expect(r.alreadyApplied).toBe(true);
    expect(applySubscriptionRenewal).not.toHaveBeenCalled();
  });

  it("valida formato do vencimento", async () => {
    await expect(
      adjustCompanyDueDate({
        companyId: 5,
        actorUserId: 1,
        dueDate: "10/12/2026",
        reason: "Acordo comercial"
      })
    ).rejects.toMatchObject({ message: "ERR_INVALID_DUE_DATE" });
  });
});
