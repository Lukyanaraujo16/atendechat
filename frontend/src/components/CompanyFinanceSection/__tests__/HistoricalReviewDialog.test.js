import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import api from "../../../services/api";
import HistoricalReviewDialog, { signalTexts } from "../HistoricalReviewDialog";

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

const invoice = {
  id: 21,
  companyId: 3,
  value: 99.9,
  dueDate: "2026-07-05",
  competence: "2026-07",
  status: "open",
  createdAt: "2026-06-20T10:00:00Z",
};
const BASE = "/saas/companies/3/finance/invoices/21/historical-review";

const preview = (over = {}) => ({
  valid: true,
  errors: [],
  alerts: [],
  decision: "historical_payment",
  revenueEffect: "revenue",
  invoiceStatusAfter: "paid",
  willRenew: false,
  payment: { amount: 99.9, paidAt: null, paidAtUnknown: true },
  ...over,
});

function renderDialog(props = {}) {
  return render(
    <HistoricalReviewDialog
      open
      companyId={3}
      invoice={invoice}
      onClose={jest.fn()}
      {...props}
    />
  );
}

const choose = (title) => fireEvent.click(screen.getByLabelText(title));
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

function selectMethod(label) {
  fireEvent.mouseDown(screen.getByLabelText(/Forma de pagamento/));
  const listbox = within(screen.getByRole("listbox"));
  fireEvent.click(listbox.getByText(label));
}

describe("HistoricalReviewDialog", () => {
  beforeEach(() => jest.clearAllMocks());

  it("explica as 4 opções e mostra sinais como indícios, não prova", () => {
    renderDialog({ signals: { adminRenewalsAfterDue: 2, coveredByCurrentDueDate: true } });
    expect(screen.getByText("Pagamento histórico confirmado")).toBeTruthy();
    expect(screen.getByText("Fatura indevida — cancelar")).toBeTruthy();
    expect(screen.getByText("Cortesia histórica")).toBeTruthy();
    expect(screen.getByText("Ainda devida / não confirmada")).toBeTruthy();
    expect(screen.getByText(/Indícios encontrados \(não são prova de pagamento\)/)).toBeTruthy();
    expect(screen.getByText(/2 renovações administrativas.*Renovação antiga não prova pagamento/)).toBeTruthy();
    expect(screen.getByText(/já cobre o período desta fatura/)).toBeTruthy();
  });

  it("valida campos condicionais do pagamento histórico e não chama a API", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    expect(screen.getByText("Escolha uma das opções.")).toBeTruthy();

    choose("Pagamento histórico confirmado");
    expect(screen.getByLabelText(/Data real do pagamento/)).toBeTruthy();
    expect(screen.getByLabelText(/Fonte da confirmação/i)).toBeTruthy();
    expect(screen.getByText(/Informe a data real/)).toBeTruthy();
    expect(screen.getByText(/Informe como foi confirmado/)).toBeTruthy();
    expect(screen.getByText(/Escolha a forma de pagamento/)).toBeTruthy();
    expect(screen.getByText(/Explique em pelo menos 5 caracteres/)).toBeTruthy();
    // valor pré-preenchido com o valor da fatura
    expect(screen.getByLabelText(/Valor pago/).value).toBe("99,90");
    type(/Valor pago/, "5000");
    expect(screen.getByText(/O valor deve ser igual ao da fatura/)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();

    // "Ainda devida" não pede fonte, data, valor nem forma.
    choose("Ainda devida / não confirmada");
    expect(screen.queryByLabelText(/Data real do pagamento/)).toBeNull();
    expect(screen.queryByLabelText(/Fonte da confirmação/i)).toBeNull();
    // Cortesia histórica pede fonte, mas não data/valor.
    choose("Cortesia histórica");
    expect(screen.getByLabelText(/Fonte da confirmação/i)).toBeTruthy();
    expect(screen.queryByLabelText(/Valor pago/)).toBeNull();
  });

  it("data desconhecida: mostra prévia antes de confirmar e envia o payload correto", async () => {
    const onDone = jest.fn();
    api.post.mockImplementation((url) =>
      url === `${BASE}/preview`
        ? Promise.resolve({ data: preview() })
        : Promise.resolve({ data: { review: { id: 1 }, invoice: { id: 21, status: "paid" }, payment: { id: 9 } } })
    );
    renderDialog({ onDone });
    choose("Pagamento histórico confirmado");
    type(/Fonte da confirmação/i, "Extrato bancário de julho");
    fireEvent.click(screen.getByLabelText(/Não sei a data/));
    expect(screen.getByLabelText(/Data real do pagamento/).disabled).toBe(true);
    selectMethod("Não sei");
    type(/Observação/, "Cliente enviou comprovante");
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));

    const payload = {
      decision: "historical_payment",
      note: "Cliente enviou comprovante",
      confirmationSource: "Extrato bancário de julho",
      paidAtUnknown: true,
      amount: 99.9,
      method: "unknown",
    };
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/preview`, payload));
    expect(await screen.findByText(/NÃO haverá renovação/)).toBeTruthy();
    expect(screen.getByText("Conta como receita recebida")).toBeTruthy();
    expect(screen.getByText(/data não informada/)).toBeTruthy();
    // ainda não aplicou
    expect(api.post).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar regularização" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.post).toHaveBeenLastCalledWith(BASE, payload);
  });

  it("data real informada e confirmação de cobrança Efí obrigatória", async () => {
    api.post.mockResolvedValue({ data: preview({ payment: { amount: 99.9, paidAt: "2026-07-06", paidAtUnknown: false } }) });
    renderDialog({ signals: { efiCharge: true } });
    choose("Pagamento histórico confirmado");
    type(/Fonte da confirmação/i, "Comprovante Pix");
    type(/Data real do pagamento/, "06072026");
    selectMethod("Pix");
    type(/Observação/, "Pago por Pix fora da Efí");
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    expect(screen.getByText("Confirme que verificou a cobrança na Efí.")).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/Verifiquei a cobrança na Efí/));
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`${BASE}/preview`, {
        decision: "historical_payment",
        note: "Pago por Pix fora da Efí",
        confirmationSource: "Comprovante Pix",
        paidAt: "2026-07-06",
        amount: 99.9,
        method: "pix",
        efiChargeAcknowledged: true,
      })
    );
    expect(await screen.findByText(/06\/07\/2026/)).toBeTruthy();
  });

  it("409 de conflito Efí orienta a conciliação e bloqueia a confirmação", async () => {
    api.post.mockRejectedValue({
      response: { status: 409, data: { error: "ERR_HISTORICAL_EFI_CONFLICT" } },
    });
    renderDialog();
    choose("Fatura indevida — cancelar");
    type(/Observação/, "Gerada em duplicidade");
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    expect(await screen.findByText(/Resolva primeiro pela guia Conciliação/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirmar regularização" }).disabled).toBe(true);
  });

  it("409 de fatura já revisada na confirmação mostra mensagem clara", async () => {
    api.post.mockImplementation((url) =>
      url.endsWith("/preview")
        ? Promise.resolve({ data: preview({ decision: "keep_pending", revenueEffect: "no_revenue", invoiceStatusAfter: "open", payment: null }) })
        : Promise.reject({ response: { status: 409, data: { error: "ERR_HISTORICAL_ALREADY_REVIEWED" } } })
    );
    const onDone = jest.fn();
    renderDialog({ onDone });
    choose("Ainda devida / não confirmada");
    type(/Observação/, "Sem comprovante ainda");
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    expect(await screen.findByText("Não conta como receita")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar regularização" }));
    expect(await screen.findByText(/já foi regularizada/)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("prévia indisponível (404) não permite confirmar", async () => {
    api.post.mockRejectedValue({ response: { status: 404, data: {} } });
    renderDialog();
    choose("Ainda devida / não confirmada");
    type(/Observação/, "Sem comprovante ainda");
    fireEvent.click(screen.getByRole("button", { name: "Ver prévia" }));
    expect(await screen.findByText(/ainda não está disponível neste servidor/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirmar regularização" }).disabled).toBe(true);
  });

  it("signalTexts ignora sinais ausentes", () => {
    expect(signalTexts(null)).toEqual([]);
    expect(signalTexts({ efiCharge: true, pendingReconciliation: true })).toHaveLength(2);
  });
});
