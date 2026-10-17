import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import api from "../../../services/api";
import CompanyTimeline from "../CompanyTimeline";

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
  default: { get: jest.fn() },
}));
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.mock("../../../errors/toastError", () => ({ __esModule: true, default: jest.fn() }));

const page1 = {
  items: [
    {
      id: "evt:2",
      occurredAt: "2026-10-15T13:00:00Z",
      kind: "payment_historical",
      title: "Fatura de julho",
      amount: 99.9,
      actor: { id: 1, name: "Alex" },
      invoiceId: 21,
      source: "ledger",
      details: { note: "Comprovante enviado" },
    },
    {
      id: "log:5",
      occurredAt: "2026-10-14T13:00:00Z",
      kind: "renewal_admin",
      title: null,
      amount: null,
      actor: null,
      invoiceId: null,
      source: "company_log",
      details: {},
    },
  ],
  nextBefore: "2026-10-14T13:00:00.000Z",
  historyStartsAt: "2026-03-01",
};
const page2 = {
  items: [
    {
      id: "inv:3",
      occurredAt: "2026-03-02T10:00:00Z",
      kind: "invoice_created",
      title: "Fatura registrada (sem histórico detalhado)",
      amount: 99.9,
      actor: null,
      invoiceId: 3,
      source: "invoice",
      details: null,
    },
  ],
  nextBefore: null,
  historyStartsAt: "2026-03-01",
};

describe("CompanyTimeline", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lista eventos, avisa sobre histórico e carrega mais via nextBefore", async () => {
    api.get.mockResolvedValueOnce({ data: page1 }).mockResolvedValueOnce({ data: page2 });
    const onOpenInvoice = jest.fn();
    render(<CompanyTimeline companyId={3} onOpenInvoice={onOpenInvoice} />);

    expect(await screen.findByText("Pagamento histórico (sem renovação)")).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith("/saas/companies/3/timeline", { params: { limit: 30 } });
    expect(screen.getByText("Renovação administrativa (sem receita)")).toBeTruthy();
    expect(screen.getByText(/por Alex/)).toBeTruthy();
    expect(screen.getByText(/sistema \/ não identificado/)).toBeTruthy();
    expect(screen.getByText(/Comprovante enviado/)).toBeTruthy();
    expect(
      screen.getByText(/Antes de 01\/03\/2026 não há histórico detalhado registrado/)
    ).toBeTruthy();
    expect(screen.getAllByTestId("timeline-item")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Fatura #21" }));
    expect(onOpenInvoice).toHaveBeenCalledWith(21);

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    await waitFor(() => expect(screen.getAllByTestId("timeline-item")).toHaveLength(3));
    expect(api.get).toHaveBeenLastCalledWith("/saas/companies/3/timeline", {
      params: { limit: 30, before: "2026-10-14T13:00:00.000Z" },
    });
    expect(screen.getByText(/Fatura registrada \(sem histórico detalhado\)/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).toBeNull();
  });

  it("sem historyStartsAt não mostra o aviso; 404 mostra mensagem amigável", async () => {
    api.get.mockResolvedValueOnce({ data: { items: [], nextBefore: null, historyStartsAt: null } });
    const { unmount } = render(<CompanyTimeline companyId={3} />);
    expect(await screen.findByText("Nenhum evento registrado")).toBeTruthy();
    expect(screen.queryByText(/não há histórico detalhado/)).toBeNull();
    unmount();

    api.get.mockRejectedValueOnce({ response: { status: 404, data: {} } });
    render(<CompanyTimeline companyId={3} />);
    expect(await screen.findByText(/linha do tempo ainda não está disponível/)).toBeTruthy();
  });
});
