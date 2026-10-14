import { getCompanyFinanceFlags } from "../companyFinanceStatus";

describe("getCompanyFinanceFlags", () => {
  it("overdue sem delinquent dentro da graça", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() - 1);
    const due = dueDate.toISOString().slice(0, 10);
    const flags = getCompanyFinanceFlags(
      { dueDate: due } as any,
      { graceDays: 3 }
    );
    expect(flags.overdue).toBe(true);
    expect(flags.delinquent).toBe(false);
    expect(flags.daysPastDue).toBeGreaterThanOrEqual(1);
    expect(flags.daysPastDue!).toBeLessThan(3);
  });

  it("delinquent após graça", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() - 5);
    const due = dueDate.toISOString().slice(0, 10);
    const flags = getCompanyFinanceFlags(
      { dueDate: due } as any,
      { graceDays: 3 }
    );
    expect(flags.overdue).toBe(true);
    expect(flags.delinquent).toBe(true);
  });
});
