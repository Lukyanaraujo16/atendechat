import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import moment from "moment";

import api from "../../../services/api";
import ManualPaymentDialog from "../ManualPaymentDialog";
import CompanyFinanceSection from "..";

if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

// Diálogos MUI são lentos no jsdom do CRA 3 quando as suítes rodam em paralelo.
jest.setTimeout(20000);

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.mock("../../../errors/toastError", () => ({ __esModule: true, default: jest.fn() }));

const invoice = { id: 11, value: 199.9, dueDate: "2026-10-10", status: "open" };
const company = { id: 3, name: "ACME", dueDate: "2026-10-10", recurrence: "MENSAL" };
const notFound = () => Promise.reject({ response: { status: 404, data: {} } });

const serverPreview = (over = {}) => ({
  valid: true,
  errors: [],
  alerts: [],
  company: { id: 3, name: "ACME" },
  invoice: { id: 11, value: 199.9, dueDate: "2026-10-10", status: "open" },
  kind: "paid_offline",
  amount: 199.9,
  method: "pix",
  previousDueDate: "2026-10-10",
  newDueDate: "2026-11-10",
  willRenew: true,
  renewalSkippedReason: null,
  revenueEffect: "revenue",
  invoiceStatusAfter: "paid",
  willUnblock: false,
  blockKind: "none",
  expectedCurrentDueDate: "2026-10-10",
  ...over,
});

function renderDialog(props = {}) {
  return render(
    <ManualPaymentDialog
      open
      companyId={3}
      company={company}
      openInvoices={[invoice]}
      onClose={jest.fn()}
      {...props}
    />
  );
}

function fillAndContinue() {
  fireEvent.change(screen.getByLabelText(/Observação/), {
    target: { value: "Recebido via Pix" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

const expectedBody = {
  invoiceId: 11,
  kind: "paid_offline",
  amount: 199.9,
  method: "pix",
  paidAt: moment().format("YYYY-MM-DD"),
  reason: "Recebido via Pix",
  renewSubscription: true,
};

describe("ManualPaymentDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({
      data: { currentDueDate: "2026-10-10", newDueDate: "2026-11-10", months: 1 },
    });
  });

  it("sem fatura aberta mostra atalho para gerar fatura", () => {
    const onGenerateInvoice = jest.fn();
    renderDialog({ openInvoices: [], onGenerateInvoice });
    expect(screen.getByText(/Não há fatura em aberto/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Gerar fatura" }));
    expect(onGenerateInvoice).toHaveBeenCalled();
  });

  it("usa a prévia do backend e envia expectedCurrentDueDate na execução", async () => {
    const onDone = jest.fn();
    api.post.mockImplementation((url) =>
      url.endsWith("/manual-payment/preview")
        ? Promise.resolve({ data: serverPreview({ willUnblock: true, blockKind: "financial" }) })
        : Promise.resolve({ data: { renewed: true, company: { dueDate: "2026-11-10" } } })
    );
    renderDialog({ onDone });
    fillAndContinue();
    expect(
      await screen.findByText(/Vencimento passará de 10\/10\/2026 para 10\/11\/2026/)
    ).toBeTruthy();
    expect(screen.getByText("Conta como receita recebida")).toBeTruthy();
    expect(screen.getByText("A empresa será desbloqueada.")).toBeTruthy();
    expect(screen.getByText("Paga")).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith(
      "/saas/companies/3/finance/manual-payment/preview",
      expectedBody
    );
    expect(api.get).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/ }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.post).toHaveBeenLastCalledWith("/saas/companies/3/finance/manual-payment", {
      ...expectedBody,
      expectedCurrentDueDate: "2026-10-10",
    });
  });

  it("mostra NÃO haverá renovação, bloqueio manual e oferece regularização histórica", async () => {
    api.post.mockResolvedValue({
      data: serverPreview({
        willRenew: false,
        newDueDate: null,
        renewalSkippedReason: "period_already_covered",
        blockKind: "manual",
        alerts: [
          { code: "MANUAL_BLOCK_KEEPS_BLOCKED", message: "Bloqueio manual continua." },
          { code: "HISTORICAL_CANDIDATE", message: "Fatura antiga: considere regularizar." },
        ],
      }),
    });
    renderDialog();
    fillAndContinue();
    expect(await screen.findByText(/NÃO haverá renovação/)).toBeTruthy();
    expect(screen.getByText(/período desta fatura já está coberto/)).toBeTruthy();
    expect(screen.getByText(/Continua bloqueada \(bloqueio manual/)).toBeTruthy();
    expect(screen.getByText("Bloqueio manual continua.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Regularizar como histórica" }));
    expect(await screen.findByText("Regularizar fatura antiga")).toBeTruthy();
  });

  it("trata 409 ERR_PAYMENT_STATE_CHANGED pedindo revisão da prévia", async () => {
    let previews = 0;
    api.post.mockImplementation((url) => {
      if (url.endsWith("/preview")) {
        previews += 1;
        return Promise.resolve({ data: serverPreview() });
      }
      return Promise.reject({
        response: { status: 409, data: { error: "ERR_PAYMENT_STATE_CHANGED" } },
      });
    });
    const onDone = jest.fn();
    renderDialog({ onDone });
    fillAndContinue();
    await screen.findByText(/Vencimento passará de/);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/ }));
    expect(await screen.findByText(/Os dados mudaram desde a prévia/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Confirmar pagamento/ }).disabled).toBe(true);
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Recalcular prévia" }));
    await waitFor(() => expect(previews).toBe(2));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Confirmar pagamento/ }).disabled).toBe(false)
    );
  });

  it("prévia inválida bloqueia a confirmação e mostra os erros", async () => {
    api.post.mockResolvedValue({
      data: serverPreview({
        valid: false,
        errors: [{ code: "INVOICE_NOT_OPEN", message: "A fatura não está mais aberta." }],
      }),
    });
    renderDialog();
    fillAndContinue();
    expect(await screen.findByText("A fatura não está mais aberta.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Confirmar pagamento/ }).disabled).toBe(true);
  });

  it("sem a prévia C6 no servidor (404) usa a prévia antiga e não envia expectedCurrentDueDate", async () => {
    const onDone = jest.fn();
    api.post.mockImplementation((url) =>
      url.endsWith("/preview")
        ? notFound()
        : Promise.resolve({ data: { renewed: false, renewalSkippedReason: "period_already_covered" } })
    );
    renderDialog({ onDone });
    fillAndContinue();
    expect(
      await screen.findByText(/Vencimento passará de 10\/10\/2026 para 10\/11\/2026/)
    ).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith("/saas/companies/3/finance/renewal-preview");
    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/ }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.post).toHaveBeenLastCalledWith(
      "/saas/companies/3/finance/manual-payment",
      expectedBody
    );
  });

  it("bloqueia valor diferente do devido", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/Valor recebido/), { target: { value: "10000" } });
    expect(screen.getByText(/Pagamento parcial ou acima do devido não é suportado/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Observação/), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.queryByText(/Revise os dados/)).toBeNull();
  });
});

describe("CompanyFinanceSection", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renderiza visão geral tolerando rotas inexistentes (404)", async () => {
    api.get.mockImplementation((url) => {
      if (url.endsWith("/summary")) {
        return Promise.resolve({
          data: {
            plan: { id: 1, name: "Pro" },
            contractedValue: 199.9,
            nextDueDate: "2026-10-10",
            totals: { billed: 500, received: 300, open: 200, overdue: 0 },
          },
        });
      }
      if (url.endsWith("/invoices")) {
        return Promise.resolve({
          data: {
            invoices: [{ ...invoice, isLegacy: true, gatewaySyncStatus: "unsupported" }],
            hasMore: false,
          },
        });
      }
      return notFound();
    });
    render(<CompanyFinanceSection companyId={3} company={company} />);
    expect(await screen.findByText("Pro")).toBeTruthy();
    expect((await screen.findAllByText("Legado")).length).toBeGreaterThan(0);
    expect(
      screen.getByText("Baixa somente local (Pix não permite baixa manual na Efí)")
    ).toBeTruthy();
    expect(screen.getByText("Conceder cortesia")).toBeTruthy();
    expect(screen.getByText(/Central de assinatura ainda não está disponível/)).toBeTruthy();
  });

  it("marca candidatas históricas, filtra e diferencia tipos de pagamento", async () => {
    const oldInvoice = { id: 21, value: 99, dueDate: "2026-07-05", status: "open", createdAt: "2026-06-20" };
    api.get.mockImplementation((url) => {
      if (url.endsWith("/invoices")) {
        return Promise.resolve({ data: { invoices: [invoice, oldInvoice], hasMore: false } });
      }
      if (url === "/saas/finance/historical-review") {
        return Promise.resolve({
          data: {
            items: [
              {
                invoice: oldInvoice,
                company: { id: 3, name: "ACME" },
                signals: { adminRenewalsAfterDue: 2 },
                review: null,
              },
            ],
            count: 1,
            hasMore: false,
          },
        });
      }
      if (url.endsWith("/payments")) {
        return Promise.resolve({
          data: {
            payments: [
              { id: 1, invoiceId: 5, amount: 99, source: "historical_payment", countsAsRevenue: true, paidAt: null, metadata: { paidAtUnknown: true } },
              { id: 2, invoiceId: 6, amount: 99, source: "paid_offline", countsAsRevenue: true, paidAt: "2026-10-01T12:00:00Z" },
            ],
          },
        });
      }
      return notFound();
    });
    render(<CompanyFinanceSection companyId={3} company={company} />);
    expect(await screen.findByText("Histórica — revisar")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Regularizar" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("tab", { name: "Pagamentos" }));
    expect(await screen.findByText("Pagamento histórico")).toBeTruthy();
    expect(screen.getByText("Pagamento atual")).toBeTruthy();
    expect(screen.getByText("data não informada")).toBeTruthy();
  });
});
