import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { toast } from "react-toastify";

import api from "../../../services/api";
import CompanyFinanceSection, { isUnresolvedHistorical } from "..";
import InvoiceFormDialog from "../InvoiceFormDialog";

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
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.mock("../../../errors/toastError", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../CompanyTimeline", () => () => null);

const mockHistoricalDialog = jest.fn(() => null);
jest.mock("../HistoricalReviewDialog", () => (props) => mockHistoricalDialog(props));

const PENDING = {
  invoice: { id: 11, companyId: 3, value: 100, dueDate: "2026-01-10", competence: "2026-01", status: "open" },
  signals: {},
  review: null,
};
const KEPT = {
  invoice: { id: 12, companyId: 3, value: 120, dueDate: "2026-02-10", competence: "2026-02", status: "open" },
  signals: {},
  review: { decision: "keep_pending", note: "Cliente diz que vai pagar" },
};
const RESOLVED = {
  invoice: { id: 13, companyId: 3, value: 90, dueDate: "2026-03-10", competence: "2026-03", status: "paid" },
  signals: {},
  review: { decision: "historical_payment", note: null },
};

function setupApi() {
  api.get.mockImplementation((url, config) => {
    if (url === "/saas/finance/historical-review") {
      return Promise.resolve({ data: { items: [PENDING, KEPT, RESOLVED], count: 3, hasMore: false } });
    }
    if (url.endsWith("/summary")) return Promise.resolve({ data: { totals: {} } });
    if (url.endsWith("/invoices")) {
      return Promise.resolve({ data: { invoices: [PENDING.invoice, KEPT.invoice], hasMore: false } });
    }
    if (url.endsWith("/subscription")) return Promise.reject({ response: { status: 404, data: {} } });
    return Promise.resolve({ data: {} });
  });
}

describe("CompanyFinanceSection — históricas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupApi();
  });

  it("isUnresolvedHistorical: pendente e mantida pendente contam; resolvida não", () => {
    expect(isUnresolvedHistorical(PENDING)).toBe(true);
    expect(isUnresolvedHistorical(KEPT)).toBe(true);
    expect(isUnresolvedHistorical(RESOLVED)).toBe(false);
  });

  it("busca state=unresolved e mantém 'Regularizar' para fatura mantida pendente, com a nota", async () => {
    render(<CompanyFinanceSection companyId={3} company={{ id: 3, name: "ACME" }} />);
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/saas/finance/historical-review", {
        params: { companyId: 3, state: "unresolved", limit: 100 },
      })
    );
    const kept = await screen.findByTestId("kept-pending-12");
    expect(kept.textContent).toMatch(/revisada — mantida pendente/);
    expect(kept.textContent).toMatch(/Cliente diz que vai pagar/);
    expect(screen.queryByTestId("kept-pending-11")).toBeNull();

    const keptRow = kept.closest("tr");
    fireEvent.click(within(keptRow).getByRole("button", { name: "Regularizar" }));
    expect(mockHistoricalDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({ open: true, invoice: expect.objectContaining({ id: 12 }) })
    );
    // 2 não resolvidas na contagem do filtro (a resolvida não entra).
    expect(screen.getAllByRole("button", { name: "Regularizar" })).toHaveLength(2);
  });
});

describe("InvoiceFormDialog — edição", () => {
  const invoice = { id: 5, value: 100, dueDate: "2026-10-10", competence: "2026-10", detail: "Plano Pro" };
  beforeEach(() => jest.clearAllMocks());

  const fillReasonAndSave = () => {
    fireEvent.change(screen.getByLabelText(/Motivo|Justificativa/i), { target: { value: "ajuste" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/i }));
  };

  it("limpar a descrição envia detail vazio; sem mudança na descrição não envia detail", async () => {
    api.put.mockResolvedValue({ data: { id: 5 } });
    const { unmount } = render(<InvoiceFormDialog open companyId={3} invoice={invoice} onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText(/Descrição/i), { target: { value: "" } });
    fillReasonAndSave();
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put.mock.calls[0][1]).toEqual({ reason: "ajuste", detail: "" });
    expect(toast.success).toHaveBeenCalled();
    unmount();

    api.put.mockClear();
    render(<InvoiceFormDialog open companyId={3} invoice={invoice} onClose={jest.fn()} />);
    fillReasonAndSave();
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put.mock.calls[0][1]).not.toHaveProperty("detail");
  });

  it("resposta unchanged: não mostra sucesso nem dispara onSaved", async () => {
    api.put.mockResolvedValue({ data: { unchanged: true } });
    const onSaved = jest.fn();
    const onClose = jest.fn();
    render(<InvoiceFormDialog open companyId={3} invoice={invoice} onSaved={onSaved} onClose={onClose} />);
    fillReasonAndSave();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
