/**
 * Monitoramento Evolution — infraestrutura (Postgres real descartável).
 * Migration EvolutionMetricSamples, ingestão do coletor (token próprio), idempotência,
 * leitura atual (online/stale/no_data), séries 24h/7d com lacunas, retenção e permissões.
 */
import "express-async-errors";
import request from "supertest";
import sequelize from "../database";
import EvolutionMetricSample from "../models/EvolutionMetricSample";
import systemAdminRoutes from "../routes/systemAdminRoutes";
import { purgeExpiredEvolutionMetrics } from "../services/SystemAdmin/EvolutionInfraMetricsService";
import { buildApp, tokenFor } from "./helpers/miniApp";
import {
  assertDisposableDatabase,
  createCompany,
  createUser,
  daysFromToday
} from "./helpers/fixtures";

// Snapshot da Evolution (HTTP externo) e atualização do sistema ficam fora deste teste.
jest.mock("../services/SystemAdmin/EvolutionMonitorService", () => ({
  getEvolutionMonitorSnapshot: jest.fn(async () => ({
    api: { status: "online", latencyMs: 10, errorCode: null, version: "2.3.7" },
    indicators: { total: 0 },
    instances: []
  }))
}));
jest.mock("../controllers/SystemUpdateController", () => ({
  getCurrent: jest.fn(),
  runAction: jest.fn()
}));

const app = buildApp([systemAdminRoutes]);
const INGEST_TOKEN = "it-ingest-token-0123456789abcdef0123456789";
const MIN = 60_000;

function sample(
  collectedAt: Date,
  overrides: { cpu?: number; apiCpu?: number } = {}
) {
  return {
    source: "vps-evolution-it",
    collectedAt: collectedAt.toISOString(),
    host: {
      cpuPercent: overrides.cpu ?? 20,
      cpuCores: 4,
      memTotalBytes: 8_000_000_000,
      memUsedBytes: 2_000_000_000,
      memAvailableBytes: 6_000_000_000,
      diskTotalBytes: 100_000_000_000,
      diskUsedBytes: 25_000_000_000,
      diskAvailableBytes: 75_000_000_000,
      load1: 0.4,
      load5: 0.3,
      load15: 0.2,
      bootAt: new Date(Date.now() - 3 * 86_400_000).toISOString()
    },
    containers: [
      {
        role: "api",
        name: "evolution-api",
        state: "running",
        running: true,
        health: null,
        startedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        restartCount: 3,
        oomKilled: false,
        cpuPercent: overrides.apiCpu ?? 5,
        memBytes: 300_000_000,
        memLimitBytes: null,
        image: "evoapicloud/evolution-api:v2.3.7"
      },
      {
        role: "postgres",
        name: "evolution-postgres",
        state: "exited",
        running: false,
        health: "unhealthy",
        startedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
        restartCount: 0,
        oomKilled: false,
        cpuPercent: null,
        memBytes: null,
        memLimitBytes: null,
        image: "postgres:15"
      }
    ]
  };
}

/** Converte o payload do coletor em linha (para semear datas fora da janela de ingestão). */
async function rowFrom(payload: ReturnType<typeof sample>) {
  const api = payload.containers.find(c => c.role === "api");
  return {
    source: payload.source,
    collectedAt: new Date(payload.collectedAt),
    hostCpuPercent: payload.host.cpuPercent,
    hostCpuCores: payload.host.cpuCores,
    hostMemTotalBytes: payload.host.memTotalBytes,
    hostMemUsedBytes: payload.host.memUsedBytes,
    hostMemAvailableBytes: payload.host.memAvailableBytes,
    hostDiskTotalBytes: payload.host.diskTotalBytes,
    hostDiskUsedBytes: payload.host.diskUsedBytes,
    hostDiskAvailableBytes: payload.host.diskAvailableBytes,
    hostLoad1: payload.host.load1,
    hostLoad5: payload.host.load5,
    hostLoad15: payload.host.load15,
    hostBootAt: new Date(payload.host.bootAt),
    apiCpuPercent: api?.cpuPercent ?? null,
    apiMemBytes: api?.memBytes ?? null,
    containers: payload.containers
  };
}

const ingest = (body: object, token = INGEST_TOKEN) =>
  request(app)
    .post("/system/evolution-metrics")
    .set("Authorization", `Bearer ${token}`)
    .send(body);

describe("Monitoramento Evolution — infraestrutura (Postgres real)", () => {
  let superToken: string;
  let commonToken: string;

  beforeAll(async () => {
    await assertDisposableDatabase();
    process.env.EVOLUTION_METRICS_INGEST_TOKEN = INGEST_TOKEN;
    const company = await createCompany({ dueDate: daysFromToday(365) });
    const superUser = await createUser({
      companyId: company.id,
      superUser: true
    });
    superToken = tokenFor({
      id: superUser.id,
      profile: "admin",
      companyId: company.id
    });
    const common = await createUser({
      companyId: company.id,
      profile: "admin"
    });
    commonToken = tokenFor({
      id: common.id,
      profile: "admin",
      companyId: company.id
    });
  });

  beforeEach(async () => {
    await EvolutionMetricSample.destroy({ where: {}, truncate: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  const monitor = (token = superToken) =>
    request(app)
      .get("/system/evolution-monitor")
      .set("Authorization", `Bearer ${token}`);
  const history = (range: string, token = superToken) =>
    request(app)
      .get(`/system/evolution-monitor/history?range=${range}`)
      .set("Authorization", `Bearer ${token}`);

  it("migration criou a tabela com índice único (source, collectedAt)", async () => {
    const [rows] = await sequelize.query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'EvolutionMetricSamples'"
    );
    const names = (rows as Array<{ indexname: string }>).map(r => r.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        "evolution_metric_samples_source_collected_unique",
        "evolution_metric_samples_collected_idx"
      ])
    );
  });

  it("sem amostras → coletor no_data, sem valores inventados; séries vazias", async () => {
    const res = await monitor();
    expect(res.status).toBe(200);
    expect(res.body.infra).toEqual({
      collector: expect.objectContaining({
        status: "no_data",
        lastCollectedAt: null
      }),
      host: null,
      services: { api: null, postgres: null, redis: null }
    });
    const h = await history("24h");
    expect(h.body).toMatchObject({ range: "24h", sampleCount: 0, points: [] });
  });

  it("ingestão: token errado 401, payload inválido 400 sem gravar nada", async () => {
    expect(
      (await ingest({ samples: [sample(new Date())] }, "x".repeat(40))).status
    ).toBe(401);
    const bad = sample(new Date());
    bad.host.cpuPercent = 250;
    const res = await ingest({ samples: [sample(new Date()), bad] });
    expect(res.status).toBe(400);
    expect(res.body.detail).toContain("samples[1].host.cpuPercent");
    expect(await EvolutionMetricSample.count()).toBe(0);
  });

  it("ingestão válida é idempotente e alimenta a leitura atual", async () => {
    const at = new Date(Date.now() - 30_000);
    expect((await ingest({ samples: [sample(at)] })).status).toBe(202);
    expect((await ingest({ samples: [sample(at)] })).status).toBe(202); // reenvio do buffer
    expect(await EvolutionMetricSample.count()).toBe(1);

    const { body } = await monitor();
    expect(body.api.version).toBe("2.3.7");
    const { collector, host, services } = body.infra;
    expect(collector).toMatchObject({
      status: "online",
      source: "vps-evolution-it"
    });
    expect(collector.ageSeconds).toBeGreaterThanOrEqual(29);
    expect(host).toMatchObject({
      cpuPercent: 20,
      cpuCores: 4,
      memory: {
        totalBytes: 8_000_000_000,
        usedBytes: 2_000_000_000,
        usedPercent: 25
      },
      disk: { usedPercent: 25 },
      loadAverage: [0.4, 0.3, 0.2]
    });
    // Uptime da VPS (boot) e do contêiner (StartedAt) são coisas distintas.
    expect(host.uptimeSeconds).toBeGreaterThan(3 * 86_400 - 60);
    expect(services.api.uptimeSeconds).toBeGreaterThan(2 * 3_600 - 60);
    expect(services.api.uptimeSeconds).toBeLessThan(2 * 3_600 + 60);
    expect(services.api).toMatchObject({
      restartCount: 3,
      cpuPercent: 5,
      memBytes: 300_000_000
    });
    expect(services.postgres).toMatchObject({
      state: "exited",
      health: "unhealthy",
      uptimeSeconds: null
    });
    expect(services.redis).toBeNull(); // não monitorado ≠ parado
  });

  it("amostra antiga → stale, uptime não é extrapolado", async () => {
    await EvolutionMetricSample.bulkCreate([
      await rowFrom(sample(new Date(Date.now() - 10 * MIN)))
    ] as never[]);
    const { body } = await monitor();
    expect(body.infra.collector.status).toBe("stale");
    expect(body.infra.host.uptimeSeconds).toBeNull();
    expect(body.infra.services.api.uptimeSeconds).toBeNull();
    expect(body.infra.host.cpuPercent).toBe(20); // última leitura conhecida
  });

  it("séries 24h: médias por 5 min, lacunas viram null (sem interpolação)", async () => {
    const now = Date.now();
    const bucket = (t: number) => Math.floor(t / 300_000) * 300_000;
    const base = bucket(now) - 60 * MIN; // 1h atrás, alinhado
    await ingest({
      samples: [
        sample(new Date(base + 1 * MIN), { cpu: 10, apiCpu: 2 }),
        sample(new Date(base + 2 * MIN), { cpu: 30, apiCpu: 4 }),
        // 5–30 min: sem amostras (coletor parado)
        sample(new Date(base + 31 * MIN), { cpu: 50, apiCpu: 6 })
      ]
    }).expect(202);

    const { body } = await history("24h");
    expect(body.bucketSeconds).toBe(300);
    expect(body.sampleCount).toBe(3);
    expect(body.points[0]).toMatchObject({
      t: new Date(base).toISOString(),
      hostCpuPercent: 20,
      hostMemPercent: 25,
      apiCpuPercent: 3,
      apiMemBytes: 300_000_000,
      samples: 2
    });
    expect(body.points[1]).toMatchObject({
      hostCpuPercent: null,
      apiCpuPercent: null,
      samples: 0
    });
    expect(body.points[6]).toMatchObject({ hostCpuPercent: 50, samples: 1 });
    // começa na primeira amostra real (nada antes da instalação) e vai até agora
    expect(body.points).toHaveLength((bucket(now) - base) / 300_000 + 1);

    const week = await history("7d");
    expect(week.body.bucketSeconds).toBe(1_800);
    expect(week.body.sampleCount).toBe(3);
  });

  it("retenção remove apenas amostras com mais de 7 dias", async () => {
    await EvolutionMetricSample.bulkCreate([
      await rowFrom(sample(new Date(Date.now() - 8 * 86_400_000))),
      await rowFrom(sample(new Date(Date.now() - 6 * 86_400_000)))
    ] as never[]);
    expect(await purgeExpiredEvolutionMetrics()).toBe(1);
    expect(await EvolutionMetricSample.count()).toBe(1);
  });

  it("consultas exclusivas do Super Admin; ingestão não aceita JWT", async () => {
    expect((await monitor(commonToken)).status).toBe(401);
    expect((await history("24h", commonToken)).status).toBe(401);
    expect(
      (await request(app).get("/system/evolution-monitor/history")).status
    ).toBe(401);
    expect(
      (await ingest({ samples: [sample(new Date())] }, superToken)).status
    ).toBe(401);
    expect(await EvolutionMetricSample.count()).toBe(0);
  });
});
