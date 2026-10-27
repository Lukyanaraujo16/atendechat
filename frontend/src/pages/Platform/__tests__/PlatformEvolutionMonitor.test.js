import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import PlatformEvolutionMonitor, {
  REFRESH_MS,
  filterInstances,
  maskWhatsappNumber,
} from "../PlatformEvolutionMonitor";

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

const mockGet = jest.fn();
jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: { get: (...args) => mockGet(...args) },
}));

const instances = [
  {
    instanceName: "streamhub-c1-w10",
    number: "5511987654321",
    state: "connected",
    linked: true,
    companyId: 1,
    companyName: "Empresa A",
    lastUpdate: "2026-10-27T10:00:00.000Z",
  },
  {
    instanceName: "streamhub-c2-w20",
    number: null,
    state: "disconnected",
    linked: true,
    companyId: 2,
    companyName: "Empresa B",
    lastUpdate: null,
  },
  {
    instanceName: "manual-orphan",
    number: "5521999990000",
    state: "connecting",
    linked: false,
    companyId: null,
    companyName: null,
    lastUpdate: null,
  },
];

const snapshot = {
  generatedAt: "2026-10-27T12:00:00.000Z",
  api: { status: "online", latencyMs: 42, errorCode: null },
  indicators: { total: 3, connected: 1, disconnected: 1, connecting: 1, companies: 2, unlinked: 1 },
  instances,
};

describe("maskWhatsappNumber", () => {
  it("mascara o meio do número", () => {
    expect(maskWhatsappNumber("5511987654321")).toBe("5511•••••4321");
    expect(maskWhatsappNumber(null)).toBe("—");
  });
});

describe("filterInstances", () => {
  const base = { company: "all", state: "all", search: "" };
  const names = (list) => list.map((i) => i.instanceName);

  it("filtra por empresa, sem empresa e estado", () => {
    expect(names(filterInstances(instances, { ...base, company: "2" }))).toEqual(["streamhub-c2-w20"]);
    expect(names(filterInstances(instances, { ...base, company: "none" }))).toEqual(["manual-orphan"]);
    expect(names(filterInstances(instances, { ...base, state: "connected" }))).toEqual(["streamhub-c1-w10"]);
  });

  it("busca por nome da instância ou por número completo", () => {
    expect(names(filterInstances(instances, { ...base, search: "ORPHAN" }))).toEqual(["manual-orphan"]);
    expect(names(filterInstances(instances, { ...base, search: "+55 11 98765" }))).toEqual(["streamhub-c1-w10"]);
  });
});

describe("PlatformEvolutionMonitor", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("mostra indicadores e tabela com número mascarado", async () => {
    mockGet.mockResolvedValue({ data: snapshot });
    render(<PlatformEvolutionMonitor />);
    await screen.findByText("streamhub-c1-w10");
    expect(mockGet).toHaveBeenCalledWith("/system/evolution-monitor");
    expect(screen.getByText("5511•••••4321")).toBeInTheDocument();
    expect(screen.queryByText("5511987654321")).not.toBeInTheDocument();
    expect(screen.getByText(/42 ms/)).toBeInTheDocument();
  });

  it("filtra a tabela pela busca", async () => {
    mockGet.mockResolvedValue({ data: snapshot });
    render(<PlatformEvolutionMonitor />);
    await screen.findByText("streamhub-c1-w10");
    const search = screen.getAllByRole("textbox").pop();
    fireEvent.change(search, { target: { value: "orphan" } });
    const table = screen.getByRole("table");
    expect(within(table).getByText("manual-orphan")).toBeInTheDocument();
    expect(within(table).queryByText("streamhub-c1-w10")).not.toBeInTheDocument();
  });

  it("exibe aviso de Evolution indisponível e estado vazio", async () => {
    mockGet.mockResolvedValue({
      data: {
        ...snapshot,
        api: { status: "offline", latencyMs: 10000, errorCode: "ERR_EVOLUTION_TIMEOUT" },
        indicators: { total: 0, connected: 0, disconnected: 0, connecting: 0, companies: 0, unlinked: 0 },
        instances: [],
      },
    });
    render(<PlatformEvolutionMonitor />);
    expect(await screen.findByText(/ERR_EVOLUTION_TIMEOUT/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("atualiza automaticamente a cada 60s e mantém dados se a requisição falhar", async () => {
    jest.useFakeTimers();
    mockGet.mockResolvedValueOnce({ data: snapshot }).mockRejectedValueOnce(new Error("net"));
    render(<PlatformEvolutionMonitor />);
    await waitFor(() => expect(screen.getByText("streamhub-c1-w10")).toBeInTheDocument());
    expect(mockGet).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(REFRESH_MS);
    });
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(screen.getByText("streamhub-c1-w10")).toBeInTheDocument();
  });
});
