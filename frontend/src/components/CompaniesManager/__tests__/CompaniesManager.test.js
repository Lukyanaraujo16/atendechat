/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { Router } from "react-router-dom";
import { createMemoryHistory } from "history";

import { changeLanguage, i18n } from "../../../translate/i18n";
import CompaniesManager from "..";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

jest.mock("../../../context/Auth/AuthContext", () => {
  const { createContext } = require("react");
  return {
    AuthContext: createContext({
      user: { id: 1, super: true, companyId: null, supportMode: false },
      enterSupportMode: jest.fn(),
    }),
  };
});

const mockRenewDialog = jest.fn(() => null);
jest.mock("../../CompanyFinanceSection/RenewSubscriptionDialog", () => (props) => mockRenewDialog(props));
jest.mock("../../ModuleSettings/FeatureGroupsEditor", () => () => null);

const mockRows = [
  { id: 1, name: "Alfa", email: "a@a.com", status: true, planId: 1, plan: { name: "Pro", value: 50 }, dueDate: "2026-12-01", recurrence: "MENSAL" },
  { id: 2, name: "Beta", email: "b@b.com", status: false, planId: null, dueDate: null, recurrence: "" },
  { id: 3, name: "Gama Atrasada", email: "g@g.com", status: true, planId: null, dueDate: "2026-10-10", recurrence: "MENSAL" },
  { id: 4, name: "Delta Manual", email: "d@d.com", status: false, planId: null, dueDate: "2026-09-01", recurrence: "MENSAL" },
  { id: 5, name: "Gama Bloqueada", email: "gb@g.com", status: false, planId: null, dueDate: "2026-08-01", recurrence: "MENSAL" },
];

const mockBillingStatus = jest.fn();
const mockHistoricalSummary = jest.fn();

jest.mock("../../../hooks/useCompanies", () => {
  const fns = {
    list: () => Promise.resolve(mockRows),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    fetchCompanyLogs: jest.fn().mockResolvedValue([]),
    fetchBillingStatus: (...args) => mockBillingStatus(...args),
    fetchHistoricalReviewSummary: (...args) => mockHistoricalSummary(...args),
  };
  return () => fns;
});
jest.mock("../../../hooks/usePlans", () => {
  const fns = { list: () => Promise.resolve([]) };
  return () => fns;
});

beforeAll(() => changeLanguage("pt"));

const BILLING_STATUS = {
  companies: [
    { companyId: 1, dueDate: "2026-12-01", financialStatus: "em_dia", operationalStatus: "ativa", blockKind: "none", daysLate: 0 },
    { companyId: 2, dueDate: null, financialStatus: "sem_vencimento", operationalStatus: "bloqueada", blockKind: "unknown", daysLate: null },
    { companyId: 3, dueDate: "2026-10-10", financialStatus: "carencia", operationalStatus: "ativa", blockKind: "none", daysLate: 7 },
    { companyId: 4, dueDate: "2026-09-01", financialStatus: "vencido", operationalStatus: "bloqueada", blockKind: "manual", daysLate: 46 },
    { companyId: 5, dueDate: "2026-08-01", financialStatus: "vencido", operationalStatus: "bloqueada", blockKind: "financial", daysLate: 77 },
  ],
};

beforeEach(() => {
  mockBillingStatus.mockReset();
  mockHistoricalSummary.mockReset();
  mockBillingStatus.mockResolvedValue(BILLING_STATUS);
  mockHistoricalSummary.mockResolvedValue({ total: 3, byCompany: { 3: 2, 5: 1 } });
});

function renderManager() {
  const history = createMemoryHistory({ initialEntries: ["/saas/companies"] });
  render(
    <Router history={history}>
      <CompaniesManager />
    </Router>
  );
  return history;
}

const visibleNames = () =>
  ["Alfa", "Beta", "Gama Atrasada", "Delta Manual", "Gama Bloqueada"].filter((n) => screen.queryByText(n));

it("lista empresas, navega para a página individual e abre o diálogo de renovação", async () => {
  const history = createMemoryHistory({ initialEntries: ["/saas/companies"] });
  render(
    <Router history={history}>
      <CompaniesManager />
    </Router>
  );
  const link = await screen.findByText("Alfa");
  expect(screen.getByText("Beta")).toBeTruthy();
  fireEvent.click(link);
  await waitFor(() => expect(history.location.pathname).toBe("/saas/companies/1"));

  const row = link.closest("tr");
  const renewBtn = within(row).getByLabelText(/Renovar/i);
  fireEvent.click(renewBtn);
  await waitFor(() => expect(mockRenewDialog).toHaveBeenCalled());
  const props = mockRenewDialog.mock.calls[mockRenewDialog.mock.calls.length - 1][0];
  expect(props.open).toBe(true);
  expect(props.company).toEqual({ id: 1, name: "Alfa", dueDate: "2026-12-01", recurrence: "MENSAL" });
});

describe("filtros operacionais (Fase 8.4-F)", () => {
  it("faz uma única chamada em lote para status e resumo de históricas (sem N+1)", async () => {
    renderManager();
    await screen.findByText("Alfa");
    await screen.findByTestId("operational-filters");
    expect(mockBillingStatus).toHaveBeenCalledTimes(1);
    expect(mockHistoricalSummary).toHaveBeenCalledTimes(1);
  });

  it("filtra por situação financeira, tipo de bloqueio e históricas pendentes", async () => {
    renderManager();
    await screen.findByText("Alfa");
    const filters = await screen.findByTestId("operational-filters");

    fireEvent.click(within(filters).getByText(/^Em dia \(1\)/));
    expect(visibleNames()).toEqual(["Alfa"]);

    fireEvent.click(within(filters).getByText(/^Vencido \(2\)/));
    expect(visibleNames()).toEqual(["Delta Manual", "Gama Bloqueada"]);

    fireEvent.click(within(filters).getByText(/^Em carência \(1\)/));
    expect(visibleNames()).toEqual(["Gama Atrasada"]);

    fireEvent.click(within(filters).getByText(/^Bloqueado financeiramente \(1\)/));
    expect(visibleNames()).toEqual(["Gama Bloqueada"]);

    fireEvent.click(within(filters).getByText(/^Bloqueado manualmente \(1\)/));
    expect(visibleNames()).toEqual(["Delta Manual"]);

    const histChip = within(filters).getByText(/^Faturas históricas a revisar \(2\) · 3 faturas/);
    fireEvent.click(histChip);
    expect(visibleNames().sort()).toEqual(["Gama Atrasada", "Gama Bloqueada"]);

    fireEvent.click(within(filters).getByText("Todas"));
    expect(visibleNames()).toHaveLength(5);
  });

  it("combina filtro operacional com a busca", async () => {
    renderManager();
    await screen.findByText("Alfa");
    const filters = await screen.findByTestId("operational-filters");
    fireEvent.click(within(filters).getByText(/^Vencido \(2\)/));
    fireEvent.change(screen.getByPlaceholderText(i18n.t("platform.companies.searchPlaceholder")), {
      target: { value: "gama" },
    });
    expect(visibleNames()).toEqual(["Gama Bloqueada"]);
  });

  it("mostra indicadores na linha e ações contextuais Financeiro / Regularizar históricas", async () => {
    const history = renderManager();
    const name = await screen.findByText("Gama Bloqueada");
    await screen.findByTestId("operational-filters");
    const row = name.closest("tr");
    expect(within(row).getByText("Bloqueado por inadimplência")).toBeTruthy();
    expect(within(row).getByText("Vencido · 77 dias")).toBeTruthy();
    expect(within(row).getByText("1 histórica a revisar")).toBeTruthy();

    const manualRow = screen.getByText("Delta Manual").closest("tr");
    expect(within(manualRow).getByText("Bloqueado manualmente")).toBeTruthy();
    // Sem históricas → sem ação de regularizar.
    expect(within(manualRow).queryByLabelText("Regularizar históricas")).toBeNull();

    fireEvent.click(within(row).getByLabelText("Regularizar históricas"));
    expect(history.location.pathname).toBe("/saas/finance/historical-review");
    expect(history.location.search).toBe("?companyId=5&state=unresolved");

    history.push("/saas/companies");
    fireEvent.click(within(screen.getByText("Gama Bloqueada").closest("tr")).getByLabelText("Financeiro"));
    expect(history.location.pathname).toBe("/saas/companies/5/financeiro");
  });

  it("'Cobrar' só abre o lembrete existente (copiar / WhatsApp manual), sem enviar nada", async () => {
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
    renderManager();
    const name = await screen.findByText("Gama Atrasada");
    const row = name.closest("tr");
    fireEvent.click(within(row).getByLabelText(/Cobrar cliente/i));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("404 no status em lote não quebra a listagem e esconde os filtros novos", async () => {
    mockBillingStatus.mockRejectedValue({ response: { status: 404, data: {} } });
    mockHistoricalSummary.mockRejectedValue({ response: { status: 404, data: {} } });
    renderManager();
    await screen.findByText("Alfa");
    expect(await screen.findByText(/ainda não está disponível no servidor/)).toBeTruthy();
    expect(screen.queryByTestId("operational-filters")).toBeNull();
    expect(visibleNames()).toHaveLength(5);
  });
});
