/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { Router, Route } from "react-router-dom";
import { createMemoryHistory } from "history";

import { changeLanguage } from "../../../translate/i18n";
import BillingSimulationPanel from "../BillingSimulationPanel";
import BillingAutomationPage from "..";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

jest.mock("../../../components/MainContainer", () => ({ children }) => <div>{children}</div>);
jest.mock("../../Platform/EfiIntegrationPanel", () => () => null);
jest.mock("../PaymentMethodsReadonlyPanel", () => () => null);

const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
const mockApiPut = jest.fn();
jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: {
    get: (...a) => mockApiGet(...a),
    post: (...a) => mockApiPost(...a),
    put: (...a) => mockApiPut(...a),
  },
}));

const SIMULATION = {
  generatedAt: "2026-10-17T12:00:00Z",
  today: "2026-10-17",
  readOnly: true,
  settings: { daysAfterDueBlock: 3 },
  jobMode: "legacy",
  summary: {
    total: 4,
    wouldBlock: 1,
    inGrace: 1,
    active: 3,
    wouldWarnBeforeDue: 2,
    wouldWarnAfterDue: 1,
    noDueDate: 1,
    blockedManual: 1,
    blockedFinancial: 0,
    blockedUnknown: 0,
  },
  companies: [
    {
      companyId: 11, name: "Loja Atrasada", dueDate: "2026-10-01", today: "2026-10-17", daysUntilDue: -16, daysLate: 16,
      financialStatus: "vencido", operationalStatus: "ativa", blockKind: "none", wouldBlock: true,
      wouldWarnBeforeDue: false, wouldWarnAfterDue: true, reasons: ["Atraso de 16 dias ≥ prazo de bloqueio (3)"],
    },
    {
      companyId: 12, name: "Loja Em Dia", dueDate: "2026-12-01", today: "2026-10-17", daysUntilDue: 45, daysLate: null,
      financialStatus: "em_dia", operationalStatus: "ativa", blockKind: "none", wouldBlock: false,
      wouldWarnBeforeDue: false, wouldWarnAfterDue: false, reasons: [],
    },
    {
      companyId: 13, name: "Loja Manual", dueDate: "2026-09-01", today: "2026-10-17", daysUntilDue: -46, daysLate: 46,
      financialStatus: "vencido", operationalStatus: "bloqueada", blockKind: "manual", wouldBlock: false,
      wouldWarnBeforeDue: false, wouldWarnAfterDue: false, reasons: ["Já bloqueada manualmente"],
    },
  ],
};

function setupApi(sim = SIMULATION) {
  mockApiGet.mockImplementation((url) => {
    if (url === "/saas/billing-automation/simulation") return Promise.resolve({ data: sim });
    if (url === "/system-settings/billing-automation") return Promise.resolve({ data: {} });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

function renderWithRouter(ui) {
  const history = createMemoryHistory({ initialEntries: ["/saas/billing-automation?tab=simulation"] });
  render(<Router history={history}>{ui}</Router>);
  return history;
}

beforeAll(() => changeLanguage("pt"));
beforeEach(() => {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPut.mockReset();
});

const EXECUTE_LIKE = /executar|rodar|aplicar|bloquear|enviar|disparar/i;

it("renderiza aviso de somente leitura, modo legado, resumo e tabela", async () => {
  setupApi();
  renderWithRouter(<BillingSimulationPanel />);

  const warning = screen.getByTestId("simulation-readonly-warning");
  expect(within(warning).getByText(/somente leitura/i)).toBeTruthy();
  expect(warning.textContent).toMatch(/Nada é executado/);

  const mode = await screen.findByTestId("simulation-job-mode");
  expect(mode.textContent).toMatch(/legado: o job atual não está avaliando vencimentos gravados como data/);
  expect(mode.textContent).toMatch(/bloqueios automáticos inativos na prática/);

  expect(screen.getByTestId("summary-wouldBlock").textContent).toBe("1");
  expect(screen.getByTestId("summary-inGrace").textContent).toBe("1");
  expect(screen.getByTestId("summary-active").textContent).toBe("3");
  expect(screen.getByTestId("summary-wouldWarnBeforeDue").textContent).toBe("2");
  expect(screen.getByTestId("summary-noDueDate").textContent).toBe("1");
  expect(screen.getByTestId("summary-blockedManual").textContent).toBe("1");
  expect(screen.getByTestId("summary-blockedFinancial").textContent).toBe("0");

  const link = screen.getByText("Loja Atrasada");
  expect(link.closest("a").getAttribute("href")).toBe("/saas/companies/11");
  const row = link.closest("tr");
  expect(within(row).getByText("01/10/2026")).toBeTruthy();
  expect(within(row).getByText("16")).toBeTruthy();
  expect(within(row).getByText("Seria bloqueada")).toBeTruthy();
  expect(within(row).getByText("Atraso de 16 dias ≥ prazo de bloqueio (3)")).toBeTruthy();
  expect(within(screen.getByText("Loja Manual").closest("tr")).getByText("Bloqueado manualmente")).toBeTruthy();

  // Nenhum botão que execute o job; apenas leitura (GET).
  screen.getAllByRole("button").forEach((b) => expect(b.textContent).not.toMatch(EXECUTE_LIKE));
  expect(mockApiPost).not.toHaveBeenCalled();
  expect(mockApiPut).not.toHaveBeenCalled();
});

it("modo normalizado e data de referência opcional (apenas GET)", async () => {
  setupApi({ ...SIMULATION, jobMode: "normalized" });
  renderWithRouter(<BillingSimulationPanel />);
  const mode = await screen.findByTestId("simulation-job-mode");
  expect(mode.textContent).toMatch(/normalizado/);
  expect(mockApiGet).toHaveBeenLastCalledWith("/saas/billing-automation/simulation", { params: {} });

  fireEvent.change(screen.getByTestId("simulation-date"), { target: { value: "2026-11-05" } });
  fireEvent.click(screen.getByText("Recalcular simulação"));
  await waitFor(() =>
    expect(mockApiGet).toHaveBeenLastCalledWith("/saas/billing-automation/simulation", {
      params: { today: "2026-11-05" },
    })
  );
  expect(mockApiPost).not.toHaveBeenCalled();
});

it("404 mostra aviso amigável", async () => {
  mockApiGet.mockRejectedValue({ response: { status: 404, data: {} } });
  renderWithRouter(<BillingSimulationPanel />);
  expect(await screen.findByText(/ainda não está disponível neste servidor/)).toBeTruthy();
});

it("página de automação abre a guia de simulação por ?tab=simulation, sem botão de execução", async () => {
  setupApi();
  renderWithRouter(<Route path="/saas/billing-automation" component={BillingAutomationPage} />);
  expect(await screen.findByRole("tab", { name: "Simulação (somente leitura)" })).toBeTruthy();
  await screen.findByTestId("simulation-summary");
  screen.getAllByRole("button").forEach((b) => expect(b.textContent).not.toMatch(EXECUTE_LIKE));
  expect(mockApiPost).not.toHaveBeenCalled();
  expect(mockApiPut).not.toHaveBeenCalled();
});
