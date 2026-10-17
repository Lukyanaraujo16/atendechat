import {
  computeNextDueDate,
  computeInvoiceCoverageEnd,
  buildCycleKey
} from "../computeNextDueDate";

describe("computeNextDueDate", () => {
  it("avança meses-calendário para MENSAL a partir de dueDate vigente", () => {
    const result = computeNextDueDate({
      currentDueDate: "2099-01-15",
      recurrence: "MENSAL",
      timezone: "America/Sao_Paulo"
    });
    expect(result.months).toBe(1);
    expect(result.newDueDate).toBe("2099-02-15");
  });

  it("avança 3 meses para TRIMESTRAL", () => {
    const result = computeNextDueDate({
      currentDueDate: "2099-01-10",
      recurrence: "TRIMESTRAL",
      timezone: "America/Sao_Paulo"
    });
    expect(result.months).toBe(3);
    expect(result.newDueDate).toBe("2099-04-10");
  });

  it("avança 12 meses para ANUAL", () => {
    const result = computeNextDueDate({
      currentDueDate: "2099-03-01",
      recurrence: "ANUAL",
      timezone: "America/Sao_Paulo"
    });
    expect(result.months).toBe(12);
    expect(result.newDueDate).toBe("2100-03-01");
  });

  it("rejeita recorrência inválida", () => {
    expect(() =>
      computeNextDueDate({
        currentDueDate: "2099-01-01",
        recurrence: "SEMANAL"
      })
    ).toThrow();
  });

  it("buildCycleKey usa YYYY-MM", () => {
    expect(buildCycleKey("2026-10-15")).toBe("2026-10");
  });

  const tz = "America/Sao_Paulo";
  const today = "2026-10-17";

  it.each([
    ["MENSAL", "2026-11-20"],
    ["TRIMESTRAL", "2027-01-20"],
    ["SEMESTRAL", "2027-04-20"],
    ["ANUAL", "2027-10-20"]
  ])("em dia: %s avança a partir do vencimento atual", (recurrence, expected) => {
    const r = computeNextDueDate({ currentDueDate: "2026-10-20", recurrence, timezone: tz, today });
    expect(r.newDueDate).toBe(expected);
    expect(r.overdue).toBe(false);
    expect(r.cyclesSkipped).toBe(0);
  });

  it("aceita Date (timestamptz do pg) sem quebrar e normaliza previousDueDate", () => {
    const r = computeNextDueDate({
      currentDueDate: new Date("2026-10-20T03:00:00.000Z"),
      recurrence: "MENSAL",
      timezone: tz,
      today
    });
    expect(r.previousDueDate).toBe("2026-10-20");
    expect(r.newDueDate).toBe("2026-11-20");
  });

  it("sem vencimento: hoje + período", () => {
    const r = computeNextDueDate({ currentDueDate: null, recurrence: "TRIMESTRAL", timezone: tz, today });
    expect(r.newDueDate).toBe("2027-01-17");
    expect(r.previousDueDate).toBeNull();
  });

  it("vencido há menos de um ciclo: preserva o dia contratual", () => {
    const r = computeNextDueDate({ currentDueDate: "2026-10-10", recurrence: "MENSAL", timezone: tz, today });
    expect(r.newDueDate).toBe("2026-11-10");
    expect(r.overdue).toBe(true);
    expect(r.cyclesSkipped).toBe(0);
  });

  it("vencido há vários ciclos: nunca gera vencimento expirado", () => {
    const r = computeNextDueDate({ currentDueDate: "2026-07-05", recurrence: "MENSAL", timezone: tz, today });
    expect(r.newDueDate).toBe("2026-11-05");
    expect(r.cyclesSkipped).toBe(3);
  });

  it("vencimento caindo exatamente hoje após avanço vai para o ciclo seguinte", () => {
    const r = computeNextDueDate({ currentDueDate: "2026-09-17", recurrence: "MENSAL", timezone: tz, today });
    expect(r.newDueDate).toBe("2026-11-17");
  });

  it("vencido TRIMESTRAL/SEMESTRAL/ANUAL preserva o dia", () => {
    expect(computeNextDueDate({ currentDueDate: "2026-08-31", recurrence: "TRIMESTRAL", timezone: tz, today }).newDueDate).toBe("2026-11-30");
    expect(computeNextDueDate({ currentDueDate: "2026-03-15", recurrence: "SEMESTRAL", timezone: tz, today }).newDueDate).toBe("2027-03-15");
    expect(computeNextDueDate({ currentDueDate: "2025-01-31", recurrence: "ANUAL", timezone: tz, today }).newDueDate).toBe("2027-01-31");
  });

  it("dia 31 sem deriva: múltiplos ciclos calculados da âncora original", () => {
    const r = computeNextDueDate({ currentDueDate: "2026-01-31", recurrence: "MENSAL", timezone: tz, today });
    expect(r.newDueDate).toBe("2026-10-31");
  });
});

describe("computeInvoiceCoverageEnd", () => {
  it("vencimento da fatura + período", () => {
    expect(computeInvoiceCoverageEnd("2026-10-10", "MENSAL")).toBe("2026-11-10");
    expect(computeInvoiceCoverageEnd("2026-10-10T00:00:00-03:00", "TRIMESTRAL")).toBe("2027-01-10");
    expect(computeInvoiceCoverageEnd(null, "MENSAL")).toBeNull();
  });
});
