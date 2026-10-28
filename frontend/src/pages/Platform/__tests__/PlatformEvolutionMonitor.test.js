import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import { formatBytes, formatDuration, serviceHealth } from "../EvolutionInfraPanel";
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

// recharts (ResponsiveContainer) usa ResizeObserver, ausente no jsdom.
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

const infra = {
  collector: { status: "online", source: "vps", lastCollectedAt: "2026-10-27T11:59:30.000Z", ageSeconds: 30 },
  host: {
    cpuPercent: 23.4,
    cpuCores: 4,
    memory: { totalBytes: 8 * 1024 ** 3, usedBytes: 2 * 1024 ** 3, availableBytes: 6 * 1024 ** 3, usedPercent: 25 },
    disk: { totalBytes: 100 * 1024 ** 3, usedBytes: 15 * 1024 ** 3, availableBytes: 85 * 1024 ** 3, usedPercent: 15 },
    loadAverage: [0.52, 0.4, 0.31],
    bootAt: "2026-10-19T08:00:00.000Z",
    uptimeSeconds: 8 * 86400 + 4 * 3600,
  },
  services: {
    api: {
      name: "evolution-api",
      state: "running",
      running: true,
      health: null,
      startedAt: "2026-10-19T11:00:04.490Z",
      uptimeSeconds: 2 * 86400 + 3 * 3600,
      restartCount: 3,
      cpuPercent: 4.5,
      memBytes: 300 * 1024 ** 2,
    },
    postgres: { name: "evolution-postgres", state: "exited", running: false, health: null, startedAt: null },
    redis: null,
  },
};

const snapshot = {
  generatedAt: "2026-10-27T12:00:00.000Z",
  api: { status: "online", latencyMs: 42, errorCode: null, version: "2.3.7" },
  indicators: { total: 3, connected: 1, disconnected: 1, connecting: 1, companies: 2, unlinked: 1 },
  instances,
  infra,
};

const history = {
  range: "24h",
  since: "2026-10-26T12:00:00.000Z",
  points: [
    { t: "2026-10-27T11:00:00.000Z", hostCpuPercent: 20, hostMemPercent: 25, apiCpuPercent: 3, apiMemBytes: 1, samples: 5 },
  ],
};

/** Responde por URL: snapshot (pode variar por chamada) e histórico. */
function mockApi(...snapshots) {
  let call = 0;
  mockGet.mockImplementation((url) => {
    if (url === "/system/evolution-monitor/history") return Promise.resolve({ data: history });
    const next = snapshots[Math.min(call, snapshots.length - 1)];
    call += 1;
    return next instanceof Error ? Promise.reject(next) : Promise.resolve({ data: next });
  });
}
const monitorCalls = () => mockGet.mock.calls.filter(([url]) => url === "/system/evolution-monitor").length;

describe("maskWhatsappNumber", () => {
  it("mascara o meio do número", () => {
    expect(maskWhatsappNumber("5511987654321")).toBe("5511•••••4321");
    expect(maskWhatsappNumber(null)).toBe("—");
  });
});

describe("formatação e saúde", () => {
  it("formatDuration e formatBytes", () => {
    expect(formatDuration(8 * 86400 + 4 * 3600 + 59)).toBe("8d 4h");
    expect(formatDuration(4500)).toBe("1h 15min");
    expect(formatDuration(59)).toBe("59s");
    expect(formatDuration(null)).toBeNull();
    expect(formatBytes(300 * 1024 ** 2)).toBe("300 MB");
    expect(formatBytes(null)).toBe("—");
  });

  it("serviceHealth", () => {
    const ok = { running: true, state: "running", health: "healthy" };
    expect(serviceHealth(ok, "online", "online").key).toBe("operational");
    expect(serviceHealth(ok, "online").key).toBe("running");
    expect(serviceHealth(ok, "stale").key).toBe("stale");
    expect(serviceHealth(null, "online").key).toBe("notMonitored");
    expect(serviceHealth({ ...ok, running: false }, "online").key).toBe("stopped");
    expect(serviceHealth(ok, "online", "offline").key).toBe("noResponse");
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
    mockApi(snapshot);
    render(<PlatformEvolutionMonitor />);
    await screen.findByText("streamhub-c1-w10");
    expect(mockGet).toHaveBeenCalledWith("/system/evolution-monitor");
    expect(screen.getByText("5511•••••4321")).toBeInTheDocument();
    expect(screen.queryByText("5511987654321")).not.toBeInTheDocument();
    expect(screen.getByText(/42 ms/)).toBeInTheDocument();
  });

  it("card da API separa status, latência e tempo online", async () => {
    mockApi(snapshot);
    render(<PlatformEvolutionMonitor />);
    await screen.findByText("streamhub-c1-w10");
    expect(screen.getByText("Online")).toHaveStyle({ color: "#2e7d32" });
    expect(screen.getByText(/Latência: 42 ms/)).toBeInTheDocument();
    expect(screen.getByText(/Tempo online: 2d 3h/)).toBeInTheDocument();
    expect(screen.queryByText(/Em breve/)).not.toBeInTheDocument();
  });

  it("mostra métricas reais da VPS e da Evolution", async () => {
    mockApi(snapshot);
    render(<PlatformEvolutionMonitor />);
    await screen.findByText("CPU da VPS");
    expect(screen.getByText("23,4%")).toBeInTheDocument();
    expect(screen.getByText("4 núcleos · load 0.52 · 0.40 · 0.31")).toBeInTheDocument();
    expect(screen.getByText("2 GB de 8 GB")).toBeInTheDocument();
    expect(screen.getByText("85 GB livres")).toBeInTheDocument();
    expect(screen.getByText("8d 4h")).toBeInTheDocument(); // uptime da VPS
    expect(screen.getByText("2d 3h")).toBeInTheDocument(); // uptime do contêiner
    expect(screen.getByText("300 MB")).toBeInTheDocument();
    expect(screen.getByText("Reinicializações").parentElement).toHaveTextContent("Reinicializações3Docker, contêiner atual");
    expect(mockGet).toHaveBeenCalledWith("/system/evolution-monitor/history", { params: { range: "24h" } });
  });

  it("saúde: Evolution operacional com versão, Postgres parado, Redis não monitorado", async () => {
    mockApi(snapshot);
    render(<PlatformEvolutionMonitor />);
    await screen.findByText("Saúde da infraestrutura");
    expect(screen.getByTestId("health-Evolution API")).toHaveTextContent("Operacional");
    expect(screen.getByText(/^v2\.3\.7 · Desde/)).toBeInTheDocument();
    expect(screen.getByTestId("health-PostgreSQL")).toHaveTextContent("Parado");
    expect(screen.getByText("Estado: exited")).toBeInTheDocument();
    expect(screen.getByTestId("health-Redis")).toHaveTextContent("Não monitorado");
    expect(screen.getByTestId("health-Coletor de métricas")).toHaveTextContent("Operacional");
  });

  it("coletor desatualizado: alerta, uptime vira — e serviços sem afirmar operação", async () => {
    mockApi({
      ...snapshot,
      infra: {
        ...infra,
        collector: { ...infra.collector, status: "stale", ageSeconds: 900 },
        host: { ...infra.host, uptimeSeconds: null },
        services: { ...infra.services, api: { ...infra.services.api, uptimeSeconds: null } },
      },
    });
    render(<PlatformEvolutionMonitor />);
    expect(await screen.findByText(/Métricas desatualizadas/)).toBeInTheDocument();
    expect(screen.getByTestId("health-Evolution API")).toHaveTextContent("Desatualizado");
    expect(screen.getByText(/Tempo online:/)).toHaveTextContent("Tempo online: —");
    expect(screen.getAllByTitle("Métrica indisponível").length).toBeGreaterThanOrEqual(2);
  });

  it("sem métricas: aviso e cards com —, sem valores inventados", async () => {
    mockApi({
      ...snapshot,
      infra: { collector: { status: "no_data" }, host: null, services: { api: null, postgres: null, redis: null } },
    });
    render(<PlatformEvolutionMonitor />);
    expect(await screen.findByText(/ainda não enviou métricas/)).toBeInTheDocument();
    expect(screen.getAllByTitle("Métrica indisponível").length).toBeGreaterThanOrEqual(8);
    expect(screen.getByTestId("health-Coletor de métricas")).toHaveTextContent("Sem dados");
  });

  it("filtra a tabela pela busca", async () => {
    mockApi(snapshot);
    render(<PlatformEvolutionMonitor />);
    await screen.findByText("streamhub-c1-w10");
    const search = screen.getAllByRole("textbox").pop();
    fireEvent.change(search, { target: { value: "orphan" } });
    const table = screen.getByRole("table");
    expect(within(table).getByText("manual-orphan")).toBeInTheDocument();
    expect(within(table).queryByText("streamhub-c1-w10")).not.toBeInTheDocument();
  });

  it("exibe aviso de Evolution indisponível e estado vazio", async () => {
    mockApi({
      ...snapshot,
      api: { status: "offline", latencyMs: 10000, errorCode: "ERR_EVOLUTION_TIMEOUT", version: null },
      indicators: { total: 0, connected: 0, disconnected: 0, connecting: 0, companies: 0, unlinked: 0 },
      instances: [],
    });
    render(<PlatformEvolutionMonitor />);
    expect(await screen.findByText(/ERR_EVOLUTION_TIMEOUT/)).toBeInTheDocument();
    expect(screen.getByText("Indisponível")).toHaveStyle({ color: "#c62828" });
    expect(screen.getByText(/Latência: —/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("atualiza automaticamente a cada 60s e mantém dados se a requisição falhar", async () => {
    jest.useFakeTimers();
    mockApi(snapshot, new Error("net"));
    render(<PlatformEvolutionMonitor />);
    await waitFor(() => expect(screen.getByText("streamhub-c1-w10")).toBeInTheDocument());
    expect(monitorCalls()).toBe(1);
    await act(async () => {
      jest.advanceTimersByTime(REFRESH_MS);
    });
    await waitFor(() => expect(monitorCalls()).toBe(2));
    expect(screen.getByText("streamhub-c1-w10")).toBeInTheDocument();
  });
});
