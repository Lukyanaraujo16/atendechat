import React from "react";
import { MemoryRouter, Route } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import PlatformWhatsappMonitor, { buildMonitorParams } from "../PlatformWhatsappMonitor";

if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}
if (typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

jest.setTimeout(20000);

const mockGet = jest.fn();
jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: { get: (...args) => mockGet(...args) },
}));

const counters = (extra) => ({
  total: 0,
  connected: 0,
  connecting: 0,
  disconnected: 0,
  unconfirmed: 0,
  companies: 0,
  companiesWithActive: 0,
  ...extra,
});

const rows = [
  {
    whatsappId: 1,
    name: "Loja A",
    provider: "baileys",
    companyId: 1,
    companyName: "Empresa A",
    companyActive: true,
    number: "5511987654321",
    status: "connected",
    statusSource: "memory",
    persistedStatus: "CONNECTED",
    lastUpdate: "2026-10-29T12:00:00.000Z",
  },
  {
    whatsappId: 2,
    name: "Loja B",
    provider: "baileys",
    companyId: 2,
    companyName: "Empresa B",
    companyActive: false,
    number: null,
    status: "unconfirmed",
    statusSource: "database",
    persistedStatus: "CONNECTED",
    lastUpdate: null,
  },
  {
    whatsappId: 10,
    name: "Evo 1",
    provider: "evolution",
    companyId: 3,
    companyName: "Empresa C",
    companyActive: true,
    number: "5521988887777",
    status: "connected",
    statusSource: "evolution_api",
    persistedStatus: "CONNECTED",
    lastUpdate: null,
  },
];

const response = (overrides = {}) => ({
  generatedAt: "2026-10-29T12:00:00.000Z",
  summary: {
    ...counters({ total: 3, connected: 2, unconfirmed: 1, companies: 3, companiesWithActive: 2 }),
    byProvider: {
      baileys: counters({ total: 2, connected: 1, unconfirmed: 1, companies: 2, companiesWithActive: 1 }),
      evolution: counters({ total: 1, connected: 1, companies: 1, companiesWithActive: 1 }),
    },
    evolution: { apiStatus: "online", errorCode: null, remoteInstances: 2, orphans: 1 },
  },
  companies: [
    { id: 1, name: "Empresa A" },
    { id: 2, name: "Empresa B" },
    { id: 3, name: "Empresa C" },
  ],
  connections: { rows, total: 60, page: 1, pageSize: 25 },
  ...overrides,
});

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Route path="/saas/whatsapp-monitor/:tab?" component={PlatformWhatsappMonitor} />
    </MemoryRouter>
  );
}

const monitorCalls = () => mockGet.mock.calls.filter(([url]) => url === "/system/whatsapp-monitor");
const lastParams = () => monitorCalls().slice(-1)[0][1].params;

describe("buildMonitorParams", () => {
  it("omite filtros 'todos' e converte página para 1-based", () => {
    const base = { company: "all", status: "all", search: "  ", page: 0, rowsPerPage: 25, sortBy: "company", sortDir: "asc" };
    expect(buildMonitorParams(base)).toEqual({ page: 1, pageSize: 25, sortBy: "company", sortDir: "asc" });
    expect(
      buildMonitorParams({ ...base, provider: "baileys", company: "3", status: "connected", search: " loja ", page: 2 })
    ).toEqual({ page: 3, pageSize: 25, sortBy: "company", sortDir: "asc", provider: "baileys", companyId: "3", status: "connected", search: "loja" });
  });
});

describe("PlatformWhatsappMonitor", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockImplementation((url) => {
      if (url === "/system/whatsapp-monitor") return Promise.resolve({ data: response() });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
  });

  it("visão geral: indicadores, tabela unificada, número completo e órfãs à parte", async () => {
    renderAt("/saas/whatsapp-monitor");
    await screen.findByText("Loja A");

    expect(screen.getByRole("tab", { name: "Visão geral" })).toHaveAttribute("aria-selected", "true");
    expect(lastParams()).toEqual({ page: 1, pageSize: 25, sortBy: "company", sortDir: "asc" });
    expect(screen.getByText("Empresas com conexão ativa")).toBeInTheDocument();
    expect(screen.getByText("+55 (11) 98765-4321")).toBeInTheDocument();
    expect(screen.getByText("+55 (21) 98888-7777")).toBeInTheDocument();
    expect(screen.getByText("Não confirmado")).toBeInTheDocument();
    expect(screen.getByText("Inativa")).toBeInTheDocument();
    expect(screen.getByText("ID 3")).toBeInTheDocument();
    expect(screen.getByText(/1 instância\(s\) na Evolution sem conexão cadastrada/)).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByText("Evolution")).toHaveLength(1);
    expect(screen.getByText("1–25 de 60")).toBeInTheDocument();
  });

  it("filtros, ordenação e paginação vão para o backend", async () => {
    renderAt("/saas/whatsapp-monitor/overview");
    await screen.findByText("Loja A");

    fireEvent.click(screen.getByRole("button", { name: /próxima página|next page/i }));
    await waitFor(() => expect(lastParams().page).toBe(2));

    fireEvent.click(within(screen.getByRole("table")).getByText("Status"));
    await waitFor(() => expect(lastParams()).toMatchObject({ sortBy: "status", sortDir: "asc", page: 1 }));

    fireEvent.change(screen.getByLabelText("Buscar nome ou número"), { target: { value: "11 98765" } });
    await waitFor(() => expect(lastParams().search).toBe("11 98765"), { timeout: 2000 });
  });

  it("Evolution indisponível: avisa sem bloquear as conexões", async () => {
    mockGet.mockResolvedValue({
      data: response({
        summary: { ...response().summary, evolution: { apiStatus: "offline", errorCode: "X", remoteInstances: 0, orphans: 0 } },
      }),
    });
    renderAt("/saas/whatsapp-monitor");
    await screen.findByText("Loja A");
    expect(screen.getByText(/API Evolution indisponível no momento/)).toBeInTheDocument();
  });

  it("falha da consulta mostra erro próprio", async () => {
    mockGet.mockRejectedValue(new Error("500"));
    renderAt("/saas/whatsapp-monitor");
    expect(await screen.findByText("Não foi possível carregar as conexões WhatsApp.")).toBeInTheDocument();
  });

  it("aba Baileys: provider fixo, explicação do estado e ID da conexão", async () => {
    renderAt("/saas/whatsapp-monitor/baileys");
    await screen.findByText("Loja A");
    expect(lastParams().provider).toBe("baileys");
    expect(screen.getByText(/Não confirmado" = o banco indica conexão/)).toBeInTheDocument();
    expect(screen.getByText("Empresas usando Baileys")).toBeInTheDocument();
    expect(screen.getByText("ID da conexão")).toBeInTheDocument();
    expect(screen.queryByLabelText("Tecnologia")).not.toBeInTheDocument();
  });

  it("aba Evolution reutiliza o monitoramento Evolution existente", async () => {
    mockGet.mockImplementation((url) =>
      url === "/system/evolution-monitor"
        ? Promise.resolve({
            data: {
              generatedAt: "2026-10-29T12:00:00.000Z",
              api: { status: "online", latencyMs: 42, errorCode: null, version: "2.3.7" },
              indicators: { total: 0, connected: 0, disconnected: 0, connecting: 0, companies: 0, unlinked: 0 },
              instances: [],
              infra: null,
            },
          })
        : Promise.resolve({ data: { range: "24h", points: [] } })
    );
    renderAt("/saas/whatsapp-monitor/evolution");
    await screen.findByText(/Latência: 42 ms/);
    expect(mockGet).toHaveBeenCalledWith("/system/evolution-monitor");
    expect(monitorCalls()).toHaveLength(0);
  });

  it("trocar de aba altera a rota", async () => {
    renderAt("/saas/whatsapp-monitor");
    await screen.findByText("Loja A");
    fireEvent.click(screen.getByRole("tab", { name: "Baileys" }));
    await waitFor(() => expect(lastParams().provider).toBe("baileys"));
    expect(screen.getByRole("tab", { name: "Baileys" })).toHaveAttribute("aria-selected", "true");
  });
});
