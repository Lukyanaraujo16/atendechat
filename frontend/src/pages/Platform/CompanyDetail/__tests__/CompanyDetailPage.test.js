/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { Router, Route } from "react-router-dom";
import { createMemoryHistory } from "history";

import { changeLanguage } from "../../../../translate/i18n";
import CompanyDetailPage from "..";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

jest.mock("../../../../components/MainContainer", () => ({ children }) => (
  <div data-testid="main">{children}</div>
));

jest.mock("../../../../context/Auth/AuthContext", () => {
  const { createContext } = require("react");
  return {
    AuthContext: createContext({
      user: { id: 1, super: true, companyId: null, supportMode: false },
      enterSupportMode: jest.fn(),
    }),
  };
});

jest.mock("../../../../context/Socket/SocketContext", () => {
  const { createContext } = require("react");
  return {
    SocketContext: createContext({
      getSocket: () => ({ on: jest.fn(), off: jest.fn() }),
    }),
  };
});

jest.mock("../../../../components/CompanyFinanceSection", () => (props) => (
  <div data-testid="finance-section">finance:{props.companyId}:{props.company?.name}</div>
));
jest.mock("../../../../components/CompanyFinanceSection/RenewSubscriptionDialog", () => () => null);
jest.mock("../../../../components/CompanyFinanceSection/useSubscriptionSummary", () => () => ({
  data: null,
  loading: false,
  unavailable: true,
  reload: jest.fn(),
}));
jest.mock("../../../../components/ModalUsers", () => () => null);
jest.mock("../../../../components/ModuleSettings/FeatureGroupsEditor", () => () => (
  <div data-testid="feature-groups" />
));

const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
jest.mock("react-toastify", () => ({
  toast: {
    error: (...a) => mockToastError(...a),
    success: (...a) => mockToastSuccess(...a),
    info: jest.fn(),
  },
}));

const company = {
  id: 5,
  name: "Loja Exemplo",
  email: "contato@loja.com",
  phone: "11912345678",
  planId: 1,
  plan: { id: 1, name: "Pro", value: 100 },
  status: true,
  dueDate: "2026-12-10",
  recurrence: "MENSAL",
  timezone: "America/Sao_Paulo",
  modulePermissions: {},
  primaryAdmin: { id: 9, name: "Admin", email: "admin@loja.com" },
};

const mockFind = jest.fn();
const mockUpdate = jest.fn();
const mockListUsers = jest.fn();
const mockSetActive = jest.fn();

jest.mock("../../../../hooks/useCompanies", () => {
  const fns = {
    find: (...a) => mockFind(...a),
    update: (...a) => mockUpdate(...a),
    remove: jest.fn(),
    fetchCompanyLogs: jest.fn().mockResolvedValue([]),
    fetchStorageSnapshots: jest.fn().mockResolvedValue([]),
    listCompanyUsers: (...a) => mockListUsers(...a),
    createCompanyUser: jest.fn(),
    updateCompanyUser: jest.fn(),
    setCompanyUserActive: (...a) => mockSetActive(...a),
    setCompanyUserPassword: jest.fn(),
  };
  return () => fns;
});

jest.mock("../../../../hooks/usePlans", () => {
  const fns = { list: () => Promise.resolve([{ id: 1, name: "Pro", value: 100 }]) };
  return () => fns;
});

function renderAt(path, getUserConfirmation) {
  const history = createMemoryHistory({ initialEntries: [path], getUserConfirmation });
  render(
    <Router history={history}>
      <Route exact path="/saas/companies/:companyId/:tab?" component={CompanyDetailPage} />
      <Route exact path="/saas/companies" render={() => <div data-testid="list-page" />} />
    </Router>
  );
  return history;
}

beforeAll(() => changeLanguage("pt"));

beforeEach(() => {
  jest.clearAllMocks();
  mockFind.mockResolvedValue({ ...company });
  mockUpdate.mockResolvedValue({});
});

it("abre a aba Cadastro por padrão e salva só o campo alterado", async () => {
  renderAt("/saas/companies/5");
  expect(await screen.findByRole("heading", { name: "Loja Exemplo" })).toBeTruthy();
  const tradeName = screen.getByLabelText("Nome fantasia");
  fireEvent.change(tradeName, { target: { value: "Loja X" } });
  const save = screen.getByRole("button", { name: /Salvar alterações/ });
  await waitFor(() => expect(save.disabled).toBe(false));
  fireEvent.click(save);
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ id: 5, tradeName: "Loja X" }));
  await waitFor(() => expect(mockFind).toHaveBeenCalledTimes(2));
  expect(mockToastSuccess).toHaveBeenCalled();
});

it("bloqueia o salvamento com CPF/CNPJ inválido", async () => {
  renderAt("/saas/companies/5/cadastro");
  await screen.findByRole("heading", { name: "Loja Exemplo" });
  fireEvent.change(screen.getByLabelText("CPF/CNPJ"), { target: { value: "52998224724" } });
  fireEvent.click(screen.getByRole("button", { name: /Salvar alterações/ }));
  expect(await screen.findByText("CPF inválido.")).toBeTruthy();
  expect(mockUpdate).not.toHaveBeenCalled();
});

it("aba Financeiro renderiza CompanyFinanceSection com a empresa", async () => {
  renderAt("/saas/companies/5/financeiro");
  expect((await screen.findByTestId("finance-section")).textContent).toBe("finance:5:Loja Exemplo");
});

it("aba inválida redireciona para cadastro", async () => {
  const history = renderAt("/saas/companies/5/xyz");
  await waitFor(() => expect(history.location.pathname).toBe("/saas/companies/5/cadastro"));
});

it("aba Usuários trata 409 ERR_LAST_ADMIN com mensagem clara", async () => {
  mockListUsers.mockResolvedValue({
    users: [{ id: 9, name: "Admin", email: "admin@loja.com", profile: "admin", active: true, online: false }],
    count: 1,
    hasMore: false,
  });
  mockSetActive.mockRejectedValue({ response: { status: 409, data: { error: "ERR_LAST_ADMIN" } } });
  renderAt("/saas/companies/5/usuarios");
  const table = await screen.findByRole("table", { name: "Usuários da empresa" });
  fireEvent.click(within(table).getByLabelText("Desativar usuário"));
  const dialog = await screen.findByRole("dialog");
  const buttons = within(dialog).getAllByRole("button");
  fireEvent.click(buttons[buttons.length - 1]);
  await waitFor(() =>
    expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("último administrador ativo"))
  );
  expect(mockListUsers).toHaveBeenCalledWith(5, { searchParam: "", pageNumber: 1 });
});

it("avisa sobre alterações não salvas ao sair, mas permite trocar de aba", async () => {
  const confirm = jest.fn((message, cb) => cb(false));
  const history = renderAt("/saas/companies/5/cadastro", confirm);
  await screen.findByRole("heading", { name: "Loja Exemplo" });
  fireEvent.change(screen.getByLabelText("Nome fantasia"), { target: { value: "Outra" } });
  await waitFor(() => expect(screen.getAllByText("Alterações não salvas").length).toBeGreaterThan(0));
  history.push("/saas/companies/5/plano");
  expect(history.location.pathname).toBe("/saas/companies/5/plano");
  expect(confirm).not.toHaveBeenCalled();
  history.push("/saas/companies");
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("alterações não salvas"), expect.any(Function));
  expect(history.location.pathname).toBe("/saas/companies/5/plano");
});
