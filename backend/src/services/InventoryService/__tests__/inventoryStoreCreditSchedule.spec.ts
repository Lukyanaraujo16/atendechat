import {
  addCivilMonthsClamped,
  distributeExactCents,
  generateStoreCreditSchedule,
  sumScheduleAmounts
} from "../inventoryStoreCreditSchedule";

describe("inventoryStoreCreditSchedule", () => {
  it("data única", () => {
    const rows = generateStoreCreditSchedule({
      financedAmount: 100,
      frequency: "once",
      installmentCount: 1,
      firstDueDate: "2026-10-15"
    });
    expect(rows).toEqual([
      { sequence: 1, dueDate: "2026-10-15", amount: 100 }
    ]);
  });

  it("semanal", () => {
    const rows = generateStoreCreditSchedule({
      financedAmount: 300,
      frequency: "weekly",
      installmentCount: 3,
      firstDueDate: "2026-01-01"
    });
    expect(rows.map(r => r.dueDate)).toEqual([
      "2026-01-01",
      "2026-01-08",
      "2026-01-15"
    ]);
  });

  it("quinzenal", () => {
    const rows = generateStoreCreditSchedule({
      financedAmount: 200,
      frequency: "biweekly",
      installmentCount: 2,
      firstDueDate: "2026-03-01"
    });
    expect(rows.map(r => r.dueDate)).toEqual(["2026-03-01", "2026-03-16"]);
  });

  it("mensal com clamping fevereiro/31", () => {
    expect(addCivilMonthsClamped("2026-01-31", 1, 31)).toBe("2026-02-28");
    expect(addCivilMonthsClamped("2024-01-31", 1, 31)).toBe("2024-02-29");
    const rows = generateStoreCreditSchedule({
      financedAmount: 300,
      frequency: "monthly",
      installmentCount: 3,
      firstDueDate: "2026-01-31"
    });
    expect(rows.map(r => r.dueDate)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31"
    ]);
  });

  it("centavos fecham exatamente na última parcela", () => {
    const amounts = distributeExactCents(100.01, 3);
    expect(amounts).toEqual([33.33, 33.33, 33.35]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBeCloseTo(100.01, 2);

    const rows = generateStoreCreditSchedule({
      financedAmount: 10.01,
      frequency: "once",
      installmentCount: 1,
      firstDueDate: "2026-10-01"
    });
    expect(sumScheduleAmounts(rows)).toBe(10.01);
  });
});
