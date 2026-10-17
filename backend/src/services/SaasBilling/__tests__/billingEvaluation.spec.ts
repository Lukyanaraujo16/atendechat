jest.mock("../../../models/CompanyLog", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

import CompanyLog from "../../../models/CompanyLog";
import {
  BillingSettingsInput,
  evaluateCompanyBilling,
  isValidDomainDate,
  loadLastBlockActions,
  resolveBillingJobMode,
  resolveBlockKind
} from "../billingEvaluation";

const settings: BillingSettingsInput = {
  daysBeforeDueWarning: 3,
  daysAfterDueWarning: 1,
  daysAfterDueBlock: 5,
  enableAutoBlock: true,
  enableAutoWarning: true
};

function evalAt(
  dueDate: Date | string | null,
  today: string,
  extra: Partial<{
    status: boolean;
    timezone: string | null;
    lastBlockAction: string | null;
    settings: Partial<BillingSettingsInput>;
  }> = {}
) {
  return evaluateCompanyBilling({
    company: {
      id: 7,
      dueDate,
      status: extra.status ?? true,
      timezone: extra.timezone ?? "America/Sao_Paulo"
    },
    lastBlockAction: extra.lastBlockAction,
    settings: { ...settings, ...(extra.settings || {}) },
    today
  });
}

describe("resolveBlockKind", () => {
  it("status true → none, independente do log", () => {
    expect(resolveBlockKind(true, "block")).toBe("none");
    expect(resolveBlockKind(true, null)).toBe("none");
  });
  it("status false: block → manual; auto_block → financial; demais → unknown", () => {
    expect(resolveBlockKind(false, "block")).toBe("manual");
    expect(resolveBlockKind(false, "auto_block")).toBe("financial");
    expect(resolveBlockKind(false, "unblock")).toBe("unknown");
    expect(resolveBlockKind(false, "auto_unblock_after_renew")).toBe("unknown");
    expect(resolveBlockKind(false, null)).toBe("unknown");
    expect(resolveBlockKind(false)).toBe("unknown");
  });
});

describe("evaluateCompanyBilling — fuso horário", () => {
  it("Date timestamptz à meia-noite de SP (03:00Z) vira o dia certo em SP", () => {
    const r = evalAt(new Date("2026-10-17T03:00:00.000Z"), "2026-10-17");
    expect(r.dueDate).toBe("2026-10-17");
    expect(r.financialStatus).toBe("vence_hoje");
    expect(r.daysLate).toBe(0);
    expect(r.daysUntilDue).toBe(0);
  });

  it("UTC perto da meia-noite (02:59Z) ainda é o dia anterior em SP", () => {
    const r = evalAt(new Date("2026-10-17T02:59:59.000Z"), "2026-10-17");
    expect(r.dueDate).toBe("2026-10-16");
    expect(r.financialStatus).toBe("carencia");
    expect(r.daysLate).toBe(1);
  });

  it("vencimento gravado é o mesmo dia para qualquer fuso de empresa (FF-D2); o fuso só define 'hoje'", () => {
    // "2026-10-17" gravado em timestamptz pela sessão -03:00 → 2026-10-17T03:00Z.
    const stored = new Date("2026-10-17T03:00:00.000Z");
    for (const timezone of ["America/Sao_Paulo", "Europe/Lisbon", "America/Manaus", "America/Rio_Branco"]) {
      const r = evalAt(stored, "2026-10-17", { timezone });
      expect(r.dueDate).toBe("2026-10-17");
      expect(r.financialStatus).toBe("vence_hoje");
    }
    // Antes da correção, Manaus/Rio Branco liam 16/10 e já entravam em carência.
    expect(evalAt(stored, "2026-10-18", { timezone: "America/Manaus" }).financialStatus).toBe("carencia");
  });

  it("fuso inválido/nulo cai em America/Sao_Paulo", () => {
    const r = evalAt(new Date("2026-10-17T02:00:00.000Z"), "2026-10-17", {
      timezone: "Mars/Olympus"
    });
    expect(r.dueDate).toBe("2026-10-16");
  });

  it("aceita string YYYY-MM-DD e ISO com offset (legado)", () => {
    expect(evalAt("2026-10-20", "2026-10-17").dueDate).toBe("2026-10-20");
    expect(evalAt("2026-10-20T00:00:00-03:00", "2026-10-17").dueDate).toBe(
      "2026-10-20"
    );
  });

  it("sem `today` usa hoje no fuso da empresa", () => {
    const r = evaluateCompanyBilling({
      company: { id: 1, dueDate: "2026-10-17", status: true, timezone: null },
      settings
    });
    expect(isValidDomainDate(r.today)).toBe(true);
  });

  it("`today` inválido é ignorado (usa hoje do fuso)", () => {
    const r = evalAt("2026-10-17", "2026-02-30");
    expect(r.today).not.toBe("2026-02-30");
    expect(isValidDomainDate(r.today)).toBe(true);
  });
});

describe("evaluateCompanyBilling — calendário", () => {
  it("virada de mês", () => {
    const r = evalAt("2026-09-30", "2026-10-01");
    expect(r.daysLate).toBe(1);
    expect(r.financialStatus).toBe("carencia");
  });

  it("virada de ano", () => {
    const r = evalAt("2026-12-31", "2027-01-05");
    expect(r.daysLate).toBe(5);
    expect(r.financialStatus).toBe("vencido");
    const r2 = evalAt("2027-01-02", "2026-12-30");
    expect(r2.daysUntilDue).toBe(3);
    expect(r2.wouldWarnBeforeDue).toBe(true);
  });

  it("29/02 em ano bissexto", () => {
    expect(evalAt("2028-02-29", "2028-03-01").daysLate).toBe(1);
    expect(evalAt("2028-02-28", "2028-03-01").daysLate).toBe(2);
    expect(evalAt("2028-02-29", "2028-02-26").daysUntilDue).toBe(3);
  });

  it("29/02 inexistente (ano não bissexto) → sem vencimento válido", () => {
    const r = evalAt("2027-02-29", "2027-03-01");
    expect(r.dueDate).toBeNull();
    expect(r.financialStatus).toBe("sem_vencimento");
  });

  it("transição de horário de verão não distorce a contagem (fuso com DST)", () => {
    // Nova York: DST termina em 2026-11-01.
    const r = evalAt("2026-10-31", "2026-11-05", { timezone: "America/New_York" });
    expect(r.daysLate).toBe(5);
  });
});

describe("evaluateCompanyBilling — carência e limites", () => {
  it("em dia", () => {
    const r = evalAt("2026-10-27", "2026-10-17");
    expect(r.financialStatus).toBe("em_dia");
    expect(r.daysUntilDue).toBe(10);
    expect(r.daysLate).toBe(0);
    expect(r.wouldBlock).toBe(false);
    expect(r.wouldWarnBeforeDue).toBe(false);
  });

  it("aviso antes do vencimento exatamente em daysBeforeDueWarning", () => {
    expect(evalAt("2026-10-20", "2026-10-17").wouldWarnBeforeDue).toBe(true);
    expect(evalAt("2026-10-21", "2026-10-17").wouldWarnBeforeDue).toBe(false);
  });

  it("aviso após vencimento exatamente em daysAfterDueWarning", () => {
    expect(evalAt("2026-10-16", "2026-10-17").wouldWarnAfterDue).toBe(true);
    expect(evalAt("2026-10-15", "2026-10-17").wouldWarnAfterDue).toBe(false);
  });

  it("daysLate = daysAfterDueBlock - 1 → carência, não bloqueia", () => {
    const r = evalAt("2026-10-13", "2026-10-17"); // 4 dias, bloqueio em 5
    expect(r.daysLate).toBe(4);
    expect(r.financialStatus).toBe("carencia");
    expect(r.wouldBlock).toBe(false);
  });

  it("daysLate = daysAfterDueBlock → vencido e bloquearia", () => {
    const r = evalAt("2026-10-12", "2026-10-17");
    expect(r.daysLate).toBe(5);
    expect(r.financialStatus).toBe("vencido");
    expect(r.wouldBlock).toBe(true);
  });

  it("enableAutoBlock false → não bloquearia, mas status financeiro é vencido", () => {
    const r = evalAt("2026-10-01", "2026-10-17", {
      settings: { enableAutoBlock: false }
    });
    expect(r.financialStatus).toBe("vencido");
    expect(r.wouldBlock).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/desativado/);
  });

  it("enableAutoWarning false → nenhum aviso", () => {
    const r = evalAt("2026-10-16", "2026-10-17", {
      settings: { enableAutoWarning: false }
    });
    expect(r.wouldWarnAfterDue).toBe(false);
  });

  it("empresa já bloqueada não bloquearia nem avisaria (o job só processa ativas)", () => {
    const r = evalAt("2026-10-01", "2026-10-17", {
      status: false,
      lastBlockAction: "auto_block"
    });
    expect(r.operationalStatus).toBe("bloqueada");
    expect(r.blockKind).toBe("financial");
    expect(r.wouldBlock).toBe(false);
    expect(r.wouldWarnAfterDue).toBe(false);
  });

  it("daysAfterDueBlock = 0: vence hoje e já bloquearia (espelha o job)", () => {
    const r = evalAt("2026-10-17", "2026-10-17", {
      settings: { daysAfterDueBlock: 0 }
    });
    expect(r.financialStatus).toBe("vence_hoje");
    expect(r.wouldBlock).toBe(true);
  });
});

describe("evaluateCompanyBilling — sem vencimento e blockKind", () => {
  it.each([null, "", "lixo"])("dueDate %p → sem_vencimento sem ações", due => {
    const r = evalAt(due as any, "2026-10-17");
    expect(r).toMatchObject({
      dueDate: null,
      daysLate: null,
      daysUntilDue: null,
      financialStatus: "sem_vencimento",
      wouldBlock: false,
      wouldWarnBeforeDue: false,
      wouldWarnAfterDue: false
    });
  });

  it("Date inválido → sem vencimento", () => {
    expect(evalAt(new Date("x"), "2026-10-17").financialStatus).toBe(
      "sem_vencimento"
    );
  });

  it("bloqueio manual é reportado", () => {
    const r = evalAt("2026-12-01", "2026-10-17", {
      status: false,
      lastBlockAction: "block"
    });
    expect(r.blockKind).toBe("manual");
    expect(r.operationalStatus).toBe("bloqueada");
    expect(r.financialStatus).toBe("em_dia");
  });

  it("bloqueada sem log → unknown", () => {
    expect(evalAt(null, "2026-10-17", { status: false }).blockKind).toBe(
      "unknown"
    );
  });
});

describe("loadLastBlockActions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lista vazia não consulta o banco", async () => {
    const r = await loadLastBlockActions([]);
    expect(r.size).toBe(0);
    expect(CompanyLog.findAll).not.toHaveBeenCalled();
  });

  it("faz UMA consulta em lote e devolve a última ação por empresa", async () => {
    (CompanyLog.findAll as jest.Mock).mockResolvedValue([
      { companyId: 1, action: "auto_block" },
      { companyId: 1, action: "block" },
      { companyId: 2, action: "unblock" },
      { companyId: 2, action: "auto_block" }
    ]);
    const r = await loadLastBlockActions([1, 2, 2, 3]);
    expect(CompanyLog.findAll).toHaveBeenCalledTimes(1);
    const arg = (CompanyLog.findAll as jest.Mock).mock.calls[0][0];
    const opIn = Object.getOwnPropertySymbols(arg.where.companyId)[0];
    expect(arg.where.companyId[opIn]).toEqual([1, 2, 3]);
    const actIn = Object.getOwnPropertySymbols(arg.where.action)[0];
    expect(arg.where.action[actIn]).toEqual([
      "block",
      "unblock",
      "auto_block",
      "auto_unblock_after_renew"
    ]);
    expect(arg.order[0]).toEqual(["companyId", "ASC"]);
    expect(arg.order[1]).toEqual(["createdAt", "DESC"]);
    expect(r.get(1)).toBe("auto_block");
    expect(r.get(2)).toBe("unblock");
    expect(r.has(3)).toBe(false);
  });
});

describe("resolveBillingJobMode", () => {
  it("default legacy; aceita true/1", () => {
    expect(resolveBillingJobMode({})).toBe("legacy");
    expect(resolveBillingJobMode({ BILLING_AUTOMATION_NORMALIZED_DATES: "false" })).toBe("legacy");
    expect(resolveBillingJobMode({ BILLING_AUTOMATION_NORMALIZED_DATES: "yes" })).toBe("legacy");
    expect(resolveBillingJobMode({ BILLING_AUTOMATION_NORMALIZED_DATES: "true" })).toBe("normalized");
    expect(resolveBillingJobMode({ BILLING_AUTOMATION_NORMALIZED_DATES: "TRUE" })).toBe("normalized");
    expect(resolveBillingJobMode({ BILLING_AUTOMATION_NORMALIZED_DATES: "1" })).toBe("normalized");
  });
});
