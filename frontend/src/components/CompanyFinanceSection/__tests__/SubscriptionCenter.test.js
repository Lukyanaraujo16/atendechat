import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import api from "../../../services/api";
import SubscriptionCenter from "../SubscriptionCenter";
import AdjustDueDateDialog from "../AdjustDueDateDialog";
import useSubscriptionSummary from "../useSubscriptionSummary";

if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

jest.setTimeout(20000);

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.mock("../../../errors/toastError", () => ({ __esModule: true, default: jest.fn() }));

const data = {
  company: { id: 3, name: "ACME", timezone: "America/Sao_Paulo" },
  plan: { id: 1, name: "Pro" },
  recurrence: "MENSAL",
  months: 1,
  contractedValue: 199.9,
  currentDueDate: "2026-10-05",
  nextCycleDueDate: "2026-11-05",
  status: {
    operational: "ativa",
    blockKind: "none",
    financial: "carencia",
    subscription: "vencida",
    daysLate: 12,
    daysUntilDue: null,
  },
  lastConfirmedPayment: {
    id: 7,
    invoiceId: 4,
    amount: 199.9,
    paidAt: null,
    paidAtUnknown: true,
    method: "unknown",
    source: "historical_payment",
  },
  nextExpectedCharge: { invoiceId: 9, value: 199.9, dueDate: "2026-10-05", isHistoricalCandidate: false },
  pendencies: {
    openInvoices: 2,
    overdueInvoices: 1,
    openAmount: 399.8,
    reconciliationPending: 1,
    historicalReviewPending: 3,
  },
};

function Harness({ companyId, onAction }) {
  const state = useSubscriptionSummary(companyId);
  return <SubscriptionCenter state={state} onAction={onAction} onReload={state.reload} />;
}

describe("SubscriptionCenter", () => {
  beforeEach(() => jest.clearAllMocks());

  it("mostra os três status separados e deixa claro que ativa ≠ em dia", async () => {
    api.get.mockResolvedValue({ data });
    render(<Harness companyId={3} />);
    expect(await screen.findByText("Operação (acesso ao sistema)")).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith("/saas/companies/3/subscription");
    expect(screen.getByText("Ativa")).toBeTruthy();
    expect(screen.getByText("Em carência")).toBeTruthy();
    expect(screen.getByText("Vencida")).toBeTruthy();
    expect(screen.getByText("12 dias de atraso")).toBeTruthy();
    expect(screen.getByText(/Uma empresa pode estar ativa com a assinatura vencida/)).toBeTruthy();
    expect(screen.getByText("05/10/2026")).toBeTruthy();
    expect(screen.getByText("05/11/2026")).toBeTruthy();
    expect(screen.getByText(/data não informada/)).toBeTruthy();
    expect(screen.getByText("Pagamento histórico")).toBeTruthy();
    expect(screen.getByText(/3 faturas antigas para revisar/)).toBeTruthy();
    expect(screen.getByText(/1 na conciliação com a Efí/)).toBeTruthy();
  });

  it("último pagamento com data YYYY-MM-DD mostra só a data (sem 00:00)", async () => {
    api.get.mockResolvedValue({
      data: {
        ...data,
        lastConfirmedPayment: { ...data.lastConfirmedPayment, paidAt: "2026-09-30", paidAtUnknown: false, source: "manual" },
      },
    });
    render(<Harness companyId={3} />);
    expect(await screen.findByText(/30\/09\/2026/)).toBeTruthy();
    expect(screen.queryByText(/00:00/)).toBeNull();
    expect(screen.queryByText(/data não informada/)).toBeNull();
  });

  it("bloqueio manual aparece com o motivo", async () => {
    api.get.mockResolvedValue({
      data: { ...data, status: { ...data.status, operational: "bloqueada", blockKind: "manual" } },
    });
    render(<Harness companyId={3} />);
    expect(await screen.findByText("Bloqueada (bloqueio manual)")).toBeTruthy();
  });

  it("404 mostra aviso amigável e mantém as ações rápidas", async () => {
    api.get.mockRejectedValue({ response: { status: 404, data: {} } });
    const onAction = jest.fn();
    render(<Harness companyId={3} onAction={onAction} />);
    expect(await screen.findByText(/ainda não está disponível neste servidor/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Ajustar vencimento/ }));
    expect(onAction).toHaveBeenCalledWith("adjust");
    fireEvent.click(screen.getByRole("button", { name: /Registrar pagamento/ }));
    expect(onAction).toHaveBeenCalledWith("payment");
  });

  it("erro inesperado oferece tentar novamente", async () => {
    api.get.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    render(<Harness companyId={3} />);
    expect(await screen.findByText(/Não foi possível carregar o resumo/)).toBeTruthy();
    api.get.mockResolvedValueOnce({ data });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Em carência")).toBeTruthy();
  });
});

describe("AdjustDueDateDialog", () => {
  beforeEach(() => jest.clearAllMocks());

  const renderAdjust = (props = {}) =>
    render(
      <AdjustDueDateDialog
        open
        companyId={3}
        companyName="ACME"
        currentDueDate="2026-10-05"
        onClose={jest.fn()}
        {...props}
      />
    );

  it("mostra atual e novo vencimento e envia YYYY-MM-DD com justificativa", async () => {
    api.post.mockResolvedValue({ data: { company: { id: 3 }, alreadyApplied: false } });
    const onDone = jest.fn();
    renderAdjust({ onDone });
    expect(screen.getByText("05/10/2026")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Nova data de vencimento/), { target: { value: "20122026" } });
    expect(screen.getByText("20/12/2026")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Justificativa/), { target: { value: "Acordo comercial" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajustar vencimento" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith("/saas/companies/3/finance/adjust-due-date", {
      dueDate: "2026-12-20",
      reason: "Acordo comercial",
    });
  });

  it("valida data e trata 409", async () => {
    api.post.mockRejectedValue({ response: { status: 409, data: { error: "ERR_RENEWAL_STALE" } } });
    renderAdjust();
    fireEvent.click(screen.getByRole("button", { name: "Ajustar vencimento" }));
    expect(screen.getByText(/Informe uma data válida/)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Nova data de vencimento/), { target: { value: "20122026" } });
    fireEvent.change(screen.getByLabelText(/Justificativa/), { target: { value: "Acordo" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajustar vencimento" }));
    expect(await screen.findByText(/O vencimento já foi alterado por outra operação/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ajustar vencimento" }).disabled).toBe(true);
  });
});
