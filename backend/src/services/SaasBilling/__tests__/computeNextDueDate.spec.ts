import { computeNextDueDate, buildCycleKey } from "../computeNextDueDate";

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
});
