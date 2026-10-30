import {
  WhatsappMonitorConnection,
  filterAndPaginate,
  getWhatsappMonitor,
  mapPersistedStatus,
  probeBaileysSession,
  resetWhatsappMonitorCache,
  resolveBaileysStatus
} from "../WhatsappMonitorService";

const mockFindAll = jest.fn();
const mockGetWbot = jest.fn();
const mockSnapshot = jest.fn();

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findAll: (...args: any[]) => mockFindAll(...args) }
}));
jest.mock("../../../models/Company", () => ({ __esModule: true, default: {} }));
jest.mock("../../../libs/wbot", () => ({
  getWbot: (...args: any[]) => mockGetWbot(...args)
}));
jest.mock("../../../utils/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
}));
jest.mock("../EvolutionMonitorService", () => ({
  ...jest.requireActual("../EvolutionMonitorService"),
  getEvolutionMonitorSnapshot: (...args: any[]) => mockSnapshot(...args)
}));

const SESSION_SECRET = "noise-key-should-never-leak";

function dbRow(fields: Record<string, any>) {
  const { sessionJid = null, ...rest } = fields;
  return {
    updatedAt: new Date("2026-10-29T12:00:00.000Z"),
    connectionProvider: "baileys",
    company: { name: `Empresa ${fields.companyId}`, status: true },
    ...rest,
    session: SESSION_SECRET,
    qrcode: "qr-secret",
    token: "token-secret",
    get: (key: string) => (key === "sessionJid" ? sessionJid : undefined)
  };
}

function liveSocket(jid: string | undefined, isOpen: boolean) {
  const sock = {
    user: jid ? { id: jid } : undefined,
    ws: { isOpen },
    logout: jest.fn(),
    end: jest.fn(),
    ev: { emit: jest.fn() }
  };
  return sock;
}

const rows = [
  // Baileys confirmado em memória; número vem do socket.
  dbRow({ id: 1, name: "Loja A", status: "CONNECTED", companyId: 1 }),
  // Baileys: banco diz CONNECTED, sem socket → não confirmado; número do creds.me.
  dbRow({
    id: 2,
    name: "Loja B",
    status: "CONNECTED",
    companyId: 1,
    sessionJid: "5511912345678:3@s.whatsapp.net"
  }),
  // Baileys desconectado sem número.
  dbRow({ id: 3, name: "Suporte", status: "DISCONNECTED", companyId: 2 }),
  // Baileys aguardando QR.
  dbRow({ id: 4, name: "Novo", status: "qrcode", companyId: 2 }),
  // Evolution vinculada e aberta na API.
  dbRow({
    id: 10,
    name: "Evo 1",
    status: "CONNECTED",
    companyId: 3,
    connectionProvider: "evolution"
  }),
  // Evolution sem instância na API → depende do banco.
  dbRow({
    id: 11,
    name: "Evo 2",
    status: "CONNECTED",
    companyId: 3,
    connectionProvider: "evolution"
  }),
  // Registro inconsistente: empresa inexistente / desativada.
  dbRow({
    id: 12,
    name: "Sem empresa",
    status: "DISCONNECTED",
    companyId: 99,
    company: null
  }),
  dbRow({
    id: 13,
    name: "Empresa inativa",
    status: "PENDING",
    companyId: 4,
    company: { name: "Inativa", status: false }
  })
];

const snapshotOnline = {
  generatedAt: "2026-10-29T12:00:00.000Z",
  api: { status: "online", latencyMs: 20, errorCode: null, version: "2.3.7" },
  indicators: {},
  instances: [
    {
      instanceName: "evo-c3-w10",
      number: "5521988887777",
      state: "connected",
      linked: true,
      companyId: 3,
      companyName: "Empresa 3",
      whatsappId: 10,
      whatsappName: "Evo 1",
      lastUpdate: "2026-10-29T11:00:00.000Z"
    },
    {
      instanceName: "manual-orphan",
      number: "5531977776666",
      state: "connected",
      linked: false,
      companyId: null,
      companyName: null,
      whatsappId: null,
      whatsappName: null,
      lastUpdate: null
    }
  ]
};

const baseQuery = {
  page: 1,
  pageSize: 25,
  sortBy: "whatsappId" as const,
  sortDir: "asc" as const
};

describe("WhatsappMonitorService", () => {
  let sockets: Record<number, ReturnType<typeof liveSocket>>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetWhatsappMonitorCache();
    sockets = {
      1: liveSocket("5511987654321:12@s.whatsapp.net", true),
      // socket registrado aguardando QR (sem user) não confirma conexão
      4: liveSocket(undefined, true)
    };
    mockGetWbot.mockImplementation((id: number) => {
      if (!sockets[id]) throw new Error("ERR_WAPP_NOT_INITIALIZED");
      return sockets[id];
    });
    mockFindAll.mockResolvedValue(rows);
    mockSnapshot.mockResolvedValue(snapshotOnline);
  });

  const byId = (list: WhatsappMonitorConnection[], id: number) =>
    list.find(c => c.whatsappId === id);

  it("identifica Baileys/Evolution, empresa, número e status por fonte", async () => {
    const res = await getWhatsappMonitor(baseQuery);
    const list = res.connections.rows;

    expect(byId(list, 1)).toMatchObject({
      provider: "baileys",
      companyId: 1,
      companyName: "Empresa 1",
      number: "5511987654321",
      status: "connected",
      statusSource: "memory"
    });
    expect(byId(list, 2)).toMatchObject({
      number: "5511912345678",
      status: "unconfirmed",
      statusSource: "database",
      persistedStatus: "CONNECTED"
    });
    expect(byId(list, 3)).toMatchObject({
      number: null,
      status: "disconnected"
    });
    expect(byId(list, 4)).toMatchObject({ status: "connecting" });
    expect(byId(list, 10)).toMatchObject({
      provider: "evolution",
      number: "5521988887777",
      status: "connected",
      statusSource: "evolution_api",
      lastUpdate: "2026-10-29T11:00:00.000Z"
    });
    expect(byId(list, 11)).toMatchObject({
      provider: "evolution",
      status: "unconfirmed",
      number: null
    });
    expect(byId(list, 12)).toMatchObject({
      companyId: null,
      companyName: null
    });
    expect(byId(list, 13)).toMatchObject({
      companyActive: false,
      status: "disconnected"
    });
  });

  it("indicadores coerentes, sem duplicar instâncias e com órfãs à parte", async () => {
    const { summary, connections } = await getWhatsappMonitor(baseQuery);

    expect(summary.total).toBe(rows.length);
    expect(connections.total).toBe(rows.length);
    expect(
      summary.connected +
        summary.connecting +
        summary.disconnected +
        summary.unconfirmed
    ).toBe(summary.total);
    expect(summary).toMatchObject({
      connected: 2,
      connecting: 1,
      disconnected: 3,
      unconfirmed: 2
    });
    expect(
      summary.byProvider.baileys.total + summary.byProvider.evolution.total
    ).toBe(summary.total);
    expect(summary.byProvider.baileys).toMatchObject({
      total: 6,
      connected: 1,
      companies: 3
    });
    expect(summary.byProvider.evolution).toMatchObject({
      total: 2,
      connected: 1,
      companies: 1
    });
    // empresas 1,2,3,4 (a 99 não existe) e só 1 e 3 com conexão ativa
    expect(summary.companies).toBe(4);
    expect(summary.companiesWithActive).toBe(2);
    expect(summary.evolution).toEqual({
      apiStatus: "online",
      errorCode: null,
      remoteInstances: 2,
      orphans: 1
    });
  });

  it("Evolution indisponível não impede a visão Baileys", async () => {
    mockSnapshot.mockRejectedValue(new Error("boom"));
    const { summary, connections } = await getWhatsappMonitor(baseQuery);

    expect(summary.evolution.apiStatus).toBe("error");
    expect(summary.byProvider.baileys.connected).toBe(1);
    expect(byId(connections.rows, 10)).toMatchObject({
      status: "unconfirmed",
      statusSource: "database"
    });
  });

  it("Evolution offline (snapshot de erro) → instâncias via banco, não confirmadas", async () => {
    mockSnapshot.mockResolvedValue({
      ...snapshotOnline,
      api: {
        status: "offline",
        latencyMs: 10000,
        errorCode: "ERR_EVOLUTION_TIMEOUT",
        version: null
      },
      instances: []
    });
    const { summary, connections } = await getWhatsappMonitor(baseQuery);
    expect(summary.evolution).toMatchObject({
      apiStatus: "offline",
      errorCode: "ERR_EVOLUTION_TIMEOUT",
      orphans: 0
    });
    expect(byId(connections.rows, 10)?.status).toBe("unconfirmed");
  });

  it("não expõe session, QR, token nem credenciais", async () => {
    const res = await getWhatsappMonitor(baseQuery);
    const body = JSON.stringify(res);
    expect(body).not.toContain(SESSION_SECRET);
    expect(body).not.toContain("qr-secret");
    expect(body).not.toContain("token-secret");
    expect(Object.keys(res.connections.rows[0]).sort()).toEqual(
      [
        "companyActive",
        "companyId",
        "companyName",
        "lastUpdate",
        "name",
        "number",
        "persistedStatus",
        "provider",
        "status",
        "statusSource",
        "whatsappId"
      ].sort()
    );
    // consulta ao banco não traz a coluna session inteira
    const attrs = mockFindAll.mock.calls[0][0].attributes;
    expect(attrs).not.toContain("session");
    expect(attrs).not.toContain("qrcode");
    expect(attrs).not.toContain("token");
  });

  it("somente leitura: não chama logout/end/emit nos sockets", async () => {
    await getWhatsappMonitor(baseQuery);
    Object.values(sockets).forEach(sock => {
      expect(sock.logout).not.toHaveBeenCalled();
      expect(sock.end).not.toHaveBeenCalled();
      expect(sock.ev.emit).not.toHaveBeenCalled();
    });
  });

  it("filtra por provider, status, empresa e busca; lista empresas do provider", async () => {
    const baileys = await getWhatsappMonitor({
      ...baseQuery,
      provider: "baileys"
    });
    expect(baileys.connections.rows.every(r => r.provider === "baileys")).toBe(
      true
    );
    expect(baileys.companies.map(c => c.id)).toEqual([1, 2, 4]);

    const connected = await getWhatsappMonitor({
      ...baseQuery,
      status: "connected"
    });
    expect(connected.connections.rows.map(r => r.whatsappId)).toEqual([1, 10]);

    const company = await getWhatsappMonitor({ ...baseQuery, companyId: 3 });
    expect(company.connections.rows.map(r => r.whatsappId)).toEqual([10, 11]);

    const byNumber = await getWhatsappMonitor({
      ...baseQuery,
      search: "(11) 91234"
    });
    expect(byNumber.connections.rows.map(r => r.whatsappId)).toEqual([2]);

    const byName = await getWhatsappMonitor({ ...baseQuery, search: "loja" });
    expect(byName.connections.rows.map(r => r.whatsappId)).toEqual([1, 2]);
    // filtros não alteram os indicadores globais
    expect(byName.summary.total).toBe(rows.length);
  });

  it("registros antigos/nulos: sem nome, status, data, empresa ou provider", async () => {
    mockFindAll.mockResolvedValue([
      dbRow({
        id: 20,
        name: null,
        status: null,
        companyId: null,
        company: null,
        connectionProvider: null,
        updatedAt: null,
        sessionJid: "999:1@lid"
      }),
      dbRow({
        id: 21,
        name: "Legado",
        status: "",
        companyId: 5,
        connectionProvider: "",
        updatedAt: "invalida"
      })
    ]);
    const { connections, summary } = await getWhatsappMonitor(baseQuery);
    expect(byId(connections.rows, 20)).toMatchObject({
      name: "",
      provider: "baileys",
      companyId: null,
      number: null,
      status: "unconfirmed",
      persistedStatus: null,
      lastUpdate: null
    });
    expect(byId(connections.rows, 21)).toMatchObject({
      provider: "baileys",
      status: "unconfirmed",
      lastUpdate: null
    });
    expect(summary).toMatchObject({
      total: 2,
      unconfirmed: 2,
      companies: 1,
      companiesWithActive: 0
    });
  });

  it("Evolution não consulta sessões Baileys em memória", async () => {
    mockFindAll.mockResolvedValue([rows[4], rows[5]]);
    await getWhatsappMonitor(baseQuery);
    expect(mockGetWbot).not.toHaveBeenCalled();
  });

  it("socket com erro ao ler propriedades não derruba o painel", async () => {
    sockets[2] = {
      get user(): never {
        throw new Error("socket quebrado");
      }
    } as any;
    const { connections } = await getWhatsappMonitor(baseQuery);
    expect(byId(connections.rows, 2)).toMatchObject({
      status: "unconfirmed",
      number: "5511912345678"
    });
  });

  it("falha do banco rejeita sem envenenar o cache; próxima chamada tenta de novo", async () => {
    mockFindAll.mockRejectedValueOnce(new Error("db down"));
    await expect(getWhatsappMonitor(baseQuery)).rejects.toThrow("db down");
    const { summary } = await getWhatsappMonitor(baseQuery);
    expect(summary.total).toBe(rows.length);
    expect(mockFindAll).toHaveBeenCalledTimes(2);
  });

  it("usa cache: filtros seguintes não reconsultam banco", async () => {
    await getWhatsappMonitor(baseQuery);
    await getWhatsappMonitor({ ...baseQuery, provider: "evolution" });
    expect(mockFindAll).toHaveBeenCalledTimes(1);
  });
});

describe("filterAndPaginate", () => {
  const make = (id: number, extra: Partial<WhatsappMonitorConnection> = {}) =>
    ({
      whatsappId: id,
      name: `Conn ${String(id).padStart(2, "0")}`,
      provider: "baileys",
      companyId: 1,
      companyName: "A",
      companyActive: true,
      number: null,
      status: "disconnected",
      statusSource: "database",
      persistedStatus: "DISCONNECTED",
      lastUpdate: null,
      ...extra
    } as WhatsappMonitorConnection);
  const list = Array.from({ length: 23 }, (_, i) => make(i + 1));

  it("pagina e limita página fora do intervalo", () => {
    const q = {
      page: 3,
      pageSize: 10,
      sortBy: "whatsappId" as const,
      sortDir: "asc" as const
    };
    const page3 = filterAndPaginate(list, q);
    expect(page3).toMatchObject({ total: 23, page: 3, pageSize: 10 });
    expect(page3.rows.map(r => r.whatsappId)).toEqual([21, 22, 23]);

    const beyond = filterAndPaginate(list, { ...q, page: 99 });
    expect(beyond.page).toBe(3);

    const huge = filterAndPaginate(list, { ...q, pageSize: 10_000 });
    expect(huge.pageSize).toBe(100);
  });

  it("ordena por status e direção sem mutar a entrada", () => {
    const mixed = [
      make(1, { status: "disconnected" }),
      make(2, { status: "connected" }),
      make(3, { status: "unconfirmed" })
    ];
    const asc = filterAndPaginate(mixed, {
      page: 1,
      pageSize: 10,
      sortBy: "status",
      sortDir: "asc"
    });
    expect(asc.rows.map(r => r.whatsappId)).toEqual([2, 3, 1]);
    const desc = filterAndPaginate(mixed, {
      page: 1,
      pageSize: 10,
      sortBy: "name",
      sortDir: "desc"
    });
    expect(desc.rows.map(r => r.whatsappId)).toEqual([3, 2, 1]);
    expect(mixed.map(r => r.whatsappId)).toEqual([1, 2, 3]);
  });
});

describe("status helpers", () => {
  it("mapPersistedStatus", () => {
    expect(mapPersistedStatus("CONNECTED")).toBe("unconfirmed");
    expect(mapPersistedStatus("qrcode")).toBe("connecting");
    expect(mapPersistedStatus("OPENING")).toBe("connecting");
    expect(mapPersistedStatus("DISCONNECTED")).toBe("disconnected");
    expect(mapPersistedStatus("PENDING")).toBe("disconnected");
    expect(mapPersistedStatus(null)).toBe("unconfirmed");
    expect(mapPersistedStatus("WEIRD")).toBe("unconfirmed");
  });

  it("resolveBaileysStatus: só socket aberto e autenticado confirma", () => {
    expect(
      resolveBaileysStatus("DISCONNECTED", { open: true, number: "1" })
    ).toEqual({
      status: "connected",
      source: "memory"
    });
    expect(
      resolveBaileysStatus("CONNECTED", { open: false, number: null })
    ).toEqual({
      status: "unconfirmed",
      source: "database"
    });
  });

  it("probeBaileysSession tolera socket ausente ou fechado", () => {
    mockGetWbot.mockImplementation(() => {
      throw new Error("ERR_WAPP_NOT_INITIALIZED");
    });
    expect(probeBaileysSession(1)).toBeNull();
    mockGetWbot.mockReturnValue(
      liveSocket("5511987654321@s.whatsapp.net", false)
    );
    expect(probeBaileysSession(1)).toEqual({
      open: false,
      number: "5511987654321"
    });
  });
});
