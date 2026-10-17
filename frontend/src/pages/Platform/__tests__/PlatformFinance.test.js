import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import PlatformFinance from "../PlatformFinance";

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

jest.mock("../../../components/MainContainer", () => ({ children }) => <div>{children}</div>);
jest.mock("../../../errors/toastError", () => ({ __esModule: true, default: jest.fn() }));

const mockApiGet = jest.fn();
jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: { get: (...args) => mockApiGet(...args) },
}));

function setupApi(kpis) {
  mockApiGet.mockImplementation((url) => {
    if (url === "/saas/finance/historical-review/summary") {
      return Promise.resolve({ data: { total: 4, pending: 3, keptPending: 1, byCompany: { 7: 4 } } });
    }
    if (url === "/saas/finance/kpis") return Promise.resolve({ data: kpis });
    if (url === "/saas/finance/invoices") return Promise.resolve({ data: { invoices: [] } });
    if (url === "/saas/finance/payments") {
      return Promise.resolve({
        data: {
          payments: [
            {
              id: 1,
              companyId: 7,
              company: { name: "Empresa Sete" },
              amount: 99.9,
              method: "unknown",
              source: "historical_payment",
              countsAsRevenue: true,
              paidAt: null,
              paidAtUnknown: true,
            },
          ],
        },
      });
    }
    return Promise.resolve({ data: {} });
  });
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <PlatformFinance />
    </MemoryRouter>
  );

beforeEach(() => mockApiGet.mockReset());

it("pagamento histórico sem data mostra 'data não informada' e origem em pt-BR", async () => {
  setupApi({ received: 100, receivedDateUnknown: 0, receivedIncludesDateUnknown: true });
  renderPage();
  await screen.findByText("Recebido");
  fireEvent.click(screen.getByRole("button", { name: "Pagamentos" }));
  expect(await screen.findByText("data não informada")).toBeTruthy();
  expect(screen.getByText("Pagamento histórico (regularização)")).toBeTruthy();
  expect(screen.getByText("Não informada")).toBeTruthy();
  expect(screen.queryByText(/Invalid date/)).toBeNull();
  expect(screen.queryByText("historical_payment")).toBeNull();
  expect(screen.queryByTestId("received-date-unknown-note")).toBeNull();
});

it("com filtro de período, mostra nota de recebidos sem data fora do período", async () => {
  setupApi({ received: 100, receivedDateUnknown: 50, receivedIncludesDateUnknown: false });
  renderPage();
  const note = await screen.findByTestId("received-date-unknown-note");
  expect(note.textContent.replace(/ /g, " ")).toBe("+ R$ 50,00 sem data informada, fora do período");
});

it("atalho de históricas abre a fila em 'não resolvidas' com o mesmo total do resumo", async () => {
  setupApi({ received: 0 });
  renderPage();
  await waitFor(() => expect(screen.getByTestId("historical-pending-chip").textContent).toBe("4 não resolvidas"));
  const link = screen.getByText("Abrir fila de revisão").closest("a");
  expect(link.getAttribute("href")).toBe("/saas/finance/historical-review?state=unresolved");
});
