/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { Router, Route } from "react-router-dom";
import { createMemoryHistory } from "history";

import HistoricalReviewPage, { PAGE_SIZE } from "..";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

jest.mock("../../../../components/MainContainer", () => ({ children }) => <div>{children}</div>);

const mockApiGet = jest.fn();
jest.mock("../../../../services/api", () => ({
  __esModule: true,
  default: { get: (...args) => mockApiGet(...args) },
}));

const mockDialog = jest.fn(() => null);
jest.mock("../../../../components/CompanyFinanceSection/HistoricalReviewDialog", () => (props) =>
  mockDialog(props)
);

const ITEM_PENDING = {
  invoice: { id: 101, companyId: 7, value: 99.9, dueDate: "2026-03-10", competence: "2026-03", detail: "Plano Pro", status: "open" },
  company: { id: 7, name: "Empresa Sete" },
  signals: { coveredByCurrentDueDate: true, adminRenewalsAfterDue: 2, efiCharge: true, pendingReconciliation: false },
  review: null,
  blockedReason: null,
};
const ITEM_RESOLVED = {
  invoice: { id: 102, companyId: 8, value: 50, dueDate: "2026-02-10", competence: "2026-02", status: "paid" },
  company: { id: 8, name: "Empresa Oito" },
  signals: {},
  review: { decision: "historical_payment", note: "Pago em dinheiro", createdAt: "2026-10-17T10:00:00Z", actor: { id: 1, name: "Alex" } },
  blockedReason: null,
};

function setupApi({ items = [ITEM_PENDING], count = 1, hasMore = false, total = 5 } = {}) {
  mockApiGet.mockImplementation((url) => {
    if (url === "/saas/finance/historical-review/summary") {
      return Promise.resolve({ data: { total, byCompany: { 7: 4, 8: 1 } } });
    }
    if (url === "/saas/finance/historical-review") {
      return Promise.resolve({ data: { items, count, hasMore } });
    }
    if (url === "/companies/list") {
      return Promise.resolve({ data: [{ id: 7, name: "Empresa Sete" }, { id: 8, name: "Empresa Oito" }] });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

function listCalls() {
  return mockApiGet.mock.calls.filter((c) => c[0] === "/saas/finance/historical-review");
}

function renderPage(path = "/saas/finance/historical-review") {
  const history = createMemoryHistory({ initialEntries: [path] });
  render(
    <Router history={history}>
      <Route path="/saas/finance/historical-review" component={HistoricalReviewPage} />
    </Router>
  );
  return history;
}

beforeEach(() => {
  mockApiGet.mockReset();
  mockDialog.mockClear();
});

it("explica a revisão, mostra contador, indícios (não prova) e situação", async () => {
  setupApi({ items: [ITEM_PENDING, ITEM_RESOLVED], count: 2 });
  renderPage();
  expect(await screen.findByText("Empresa Sete")).toBeTruthy();
  expect(screen.getByText(/não provam pagamento/)).toBeTruthy();
  await waitFor(() => expect(screen.getByTestId("historical-pending-total").textContent).toBe("5"));

  const row = screen.getByTestId("historical-row-101");
  expect(within(row).getByText("Vencimento atual já cobre o período")).toBeTruthy();
  expect(within(row).getByText("2 renovações manuais depois do vencimento")).toBeTruthy();
  expect(within(row).getByText("Cobrança Efí gerada")).toBeTruthy();
  expect(within(row).getByText("Pendente de revisão")).toBeTruthy();
  expect(within(row).getByText("03/2026")).toBeTruthy();

  const resolved = screen.getByTestId("historical-row-102");
  expect(within(resolved).getByText("Resolvida: Pagamento histórico registrado")).toBeTruthy();
  expect(within(resolved).queryByText("Revisar")).toBeNull();

  // Sem ações em massa.
  expect(screen.queryByRole("checkbox")).toBeNull();
  // Filtro padrão: não resolvidas (pendentes + mantidas pendentes), igual ao contador do resumo.
  expect(listCalls()[0][1].params).toEqual({ companyId: undefined, state: "unresolved", page: 1, limit: PAGE_SIZE });
  expect(screen.getByText("Não resolvidas (todas as empresas)")).toBeTruthy();
});

it("state=pending explícito na URL continua filtrando só pendentes; state inválido cai em não resolvidas", async () => {
  setupApi();
  const history = renderPage("/saas/finance/historical-review?state=pending");
  await screen.findByTestId("historical-row-101");
  expect(listCalls()[0][1].params.state).toBe("pending");
  history.replace("/saas/finance/historical-review?state=xyz");
  await waitFor(() => expect(listCalls()[listCalls().length - 1][1].params.state).toBe("unresolved"));
});

it("aplica filtro de empresa vindo da URL (atalho da listagem) e troca de estado", async () => {
  setupApi();
  const history = renderPage("/saas/finance/historical-review?companyId=7");
  await screen.findByTestId("historical-row-101");
  expect(listCalls()[0][1].params.companyId).toBe("7");

  history.replace("/saas/finance/historical-review?companyId=7&state=kept_pending");
  await waitFor(() => {
    const last = listCalls()[listCalls().length - 1][1].params;
    expect(last).toEqual({ companyId: "7", state: "kept_pending", page: 1, limit: PAGE_SIZE });
  });
});

it("altera a situação pelo seletor e mantém a empresa", async () => {
  setupApi();
  const history = renderPage("/saas/finance/historical-review?companyId=7");
  await screen.findByTestId("historical-row-101");
  const select = screen.getByLabelText("Situação");
  fireEvent.mouseDown(select);
  fireEvent.click(await screen.findByRole("option", { name: "Resolvidas" }));
  await waitFor(() => expect(history.location.search).toBe("?companyId=7&state=resolved"));
  await waitFor(() => {
    const last = listCalls()[listCalls().length - 1][1].params;
    expect(last.state).toBe("resolved");
    expect(last.companyId).toBe("7");
  });
});

it("paginação: Próxima/Anterior respeitam hasMore", async () => {
  setupApi({ count: 45, hasMore: true });
  const history = renderPage();
  await screen.findByTestId("historical-row-101");
  expect(screen.getByTestId("historical-pager").textContent).toMatch(/45 faturas · página 1 de 3/);
  expect(screen.getByText("Anterior").closest("button").disabled).toBe(true);

  fireEvent.click(screen.getByText("Próxima"));
  await waitFor(() => expect(history.location.search).toBe("?page=2"));
  await waitFor(() => expect(listCalls()[listCalls().length - 1][1].params.page).toBe(2));

  setupApi({ count: 45, hasMore: false });
  history.replace("/saas/finance/historical-review?page=3");
  await waitFor(() => expect(screen.getByText("Próxima").closest("button").disabled).toBe(true));
});

it("Revisar abre o HistoricalReviewDialog e, ao concluir, recarrega mantendo os filtros", async () => {
  setupApi();
  renderPage("/saas/finance/historical-review?companyId=7&state=kept_pending");
  const row = await screen.findByTestId("historical-row-101");
  const callsBefore = listCalls().length;
  fireEvent.click(within(row).getByText("Revisar"));

  await waitFor(() => expect(mockDialog).toHaveBeenCalled());
  const props = mockDialog.mock.calls[mockDialog.mock.calls.length - 1][0];
  expect(props.open).toBe(true);
  expect(props.companyId).toBe(7);
  expect(props.invoice).toEqual(ITEM_PENDING.invoice);
  expect(typeof props.onClose).toBe("function");

  await props.onDone({ review: {} });
  await waitFor(() => expect(listCalls().length).toBe(callsBefore + 1));
  expect(listCalls()[listCalls().length - 1][1].params).toEqual({
    companyId: "7",
    state: "kept_pending",
    page: 1,
    limit: PAGE_SIZE,
  });
});

it("404 do servidor mostra aviso amigável", async () => {
  mockApiGet.mockImplementation((url) => {
    if (url === "/companies/list") return Promise.resolve({ data: [] });
    return Promise.reject({ response: { status: 404, data: {} } });
  });
  renderPage();
  expect(await screen.findByText(/ainda não está disponível neste servidor/)).toBeTruthy();
});
