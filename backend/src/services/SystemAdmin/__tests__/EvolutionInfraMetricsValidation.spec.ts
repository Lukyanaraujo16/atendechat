import {
  EVOLUTION_METRICS_MAX_BATCH,
  parseEvolutionMetricsBatch,
  verifyEvolutionMetricsIngestToken
} from "../EvolutionInfraMetricsService";

jest.mock("../../../models/EvolutionMetricSample", () => ({
  __esModule: true,
  default: {}
}));

const NOW = Date.parse("2026-10-27T12:00:00.000Z");
const TOKEN = "x".repeat(40);

function sample(overrides: Record<string, any> = {}) {
  return {
    source: "vmi-evolution",
    collectedAt: "2026-10-27T11:59:00.000Z",
    host: {
      cpuPercent: 12.5,
      cpuCores: 4,
      memTotalBytes: 8_000_000_000,
      memUsedBytes: 2_000_000_000,
      memAvailableBytes: 6_000_000_000,
      diskTotalBytes: 100_000_000_000,
      diskUsedBytes: 15_000_000_000,
      diskAvailableBytes: 85_000_000_000,
      load1: 0.5,
      load5: 0.4,
      load15: 0.3,
      bootAt: "2026-10-19T08:00:00.000Z"
    },
    containers: [
      {
        role: "api",
        name: "evolution-pilot-api",
        state: "running",
        running: true,
        health: null,
        startedAt: "2026-10-19T11:00:04.490Z",
        restartCount: 1,
        oomKilled: false,
        cpuPercent: 3.2,
        memBytes: 250_000_000,
        memLimitBytes: null,
        image: "evoapicloud/evolution-api:v2.3.7"
      },
      {
        role: "redis",
        name: "evolution-pilot-redis",
        state: "running",
        running: true,
        health: "healthy",
        startedAt: "2026-10-19T11:00:04.472Z",
        restartCount: 0,
        oomKilled: false,
        cpuPercent: 0.1,
        memBytes: 5_000_000,
        memLimitBytes: null,
        image: "redis:7"
      }
    ],
    ...overrides
  };
}

const parse = (samples: unknown[]) =>
  parseEvolutionMetricsBatch({ samples }, NOW);

describe("parseEvolutionMetricsBatch", () => {
  it("aceita amostra válida e desnormaliza consumo da Evolution API", () => {
    const [row] = parse([sample()]);
    expect(row).toMatchObject({
      source: "vmi-evolution",
      hostCpuPercent: 12.5,
      hostMemTotalBytes: 8_000_000_000,
      apiCpuPercent: 3.2,
      apiMemBytes: 250_000_000
    });
    expect(row.collectedAt.toISOString()).toBe("2026-10-27T11:59:00.000Z");
    expect(row.containers).toHaveLength(2);
  });

  it("descarta campos fora da whitelist (nada além do contrato é persistido)", () => {
    const evil = sample();
    (evil as any).env = ["EVOLUTION_API_KEY=segredo"];
    (evil.containers[0] as any).env = ["AUTHENTICATION_API_KEY=segredo"];
    const [row] = parse([evil]);
    expect(JSON.stringify(row)).not.toContain("segredo");
  });

  it("sem contêiner api → consumo da Evolution fica null", () => {
    const [row] = parse([sample({ containers: [] })]);
    expect(row.apiCpuPercent).toBeNull();
    expect(row.apiMemBytes).toBeNull();
  });

  it.each([
    [
      "CPU acima de 100%",
      s => {
        s.host.cpuPercent = 140;
      },
      "host.cpuPercent"
    ],
    [
      "CPU negativa",
      s => {
        s.host.cpuPercent = -1;
      },
      "host.cpuPercent"
    ],
    [
      "CPU não numérica",
      s => {
        s.host.cpuPercent = "10";
      },
      "host.cpuPercent"
    ],
    [
      "RAM usada > total",
      s => {
        s.host.memUsedBytes = 9_000_000_000;
      },
      "host.memUsedBytes"
    ],
    [
      "disco usado > total",
      s => {
        s.host.diskUsedBytes = 200_000_000_000;
      },
      "host.diskUsedBytes"
    ],
    [
      "bytes fracionários",
      s => {
        s.host.memTotalBytes = 1.5;
      },
      "host.memTotalBytes"
    ],
    [
      "source inválido",
      s => {
        s.source = "x; drop table";
      },
      "source"
    ],
    [
      "data no futuro",
      s => {
        s.collectedAt = "2026-10-27T13:00:00.000Z";
      },
      "collectedAt"
    ],
    [
      "mais antiga que a retenção",
      s => {
        s.collectedAt = "2026-10-01T00:00:00.000Z";
      },
      "collectedAt"
    ],
    [
      "data inválida",
      s => {
        s.collectedAt = "ontem";
      },
      "collectedAt"
    ],
    [
      "papel desconhecido",
      s => {
        s.containers[0].role = "docker";
      },
      "containers[0].role"
    ],
    [
      "estado desconhecido",
      s => {
        s.containers[0].state = "hacked";
      },
      "containers[0].state"
    ],
    [
      "papel duplicado",
      s => {
        s.containers[1].role = "api";
      },
      "containers"
    ],
    [
      "nome de contêiner inválido",
      s => {
        s.containers[0].name = "../etc";
      },
      "containers[0].name"
    ],
    [
      "reinícios negativos",
      s => {
        s.containers[0].restartCount = -2;
      },
      "containers[0].restartCount"
    ],
    [
      "host ausente",
      s => {
        delete s.host;
      },
      "host"
    ]
  ] as Array<[string, (s: any) => void, string]>)(
    "rejeita %s",
    (_label, mutate, path) => {
      const s = sample();
      mutate(s);
      expect(() => parse([s])).toThrow(`samples[0].${path}`);
    }
  );

  it("rejeita lote vazio, não-array e acima do limite", () => {
    expect(() => parse([])).toThrow("samples");
    expect(() => parseEvolutionMetricsBatch({ samples: "x" }, NOW)).toThrow(
      "samples"
    );
    expect(() => parseEvolutionMetricsBatch(null, NOW)).toThrow("body");
    const many = Array.from({ length: EVOLUTION_METRICS_MAX_BATCH + 1 }, () =>
      sample()
    );
    expect(() => parse(many)).toThrow("samples");
  });
});

describe("verifyEvolutionMetricsIngestToken", () => {
  const OLD = process.env.EVOLUTION_METRICS_INGEST_TOKEN;
  afterEach(() => {
    process.env.EVOLUTION_METRICS_INGEST_TOKEN = OLD;
  });

  it("sem token configurado (ou curto) → not_configured", () => {
    delete process.env.EVOLUTION_METRICS_INGEST_TOKEN;
    expect(verifyEvolutionMetricsIngestToken(TOKEN)).toBe("not_configured");
    process.env.EVOLUTION_METRICS_INGEST_TOKEN = "curto";
    expect(verifyEvolutionMetricsIngestToken("curto")).toBe("not_configured");
  });

  it("aceita somente o token exato", () => {
    process.env.EVOLUTION_METRICS_INGEST_TOKEN = TOKEN;
    expect(verifyEvolutionMetricsIngestToken(TOKEN)).toBe("ok");
    expect(verifyEvolutionMetricsIngestToken(`${TOKEN}x`)).toBe("invalid");
    expect(verifyEvolutionMetricsIngestToken("y".repeat(40))).toBe("invalid");
    expect(verifyEvolutionMetricsIngestToken(null)).toBe("invalid");
  });
});
