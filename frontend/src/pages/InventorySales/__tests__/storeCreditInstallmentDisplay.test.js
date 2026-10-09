/**
 * @jest-environment jsdom
 */
import { changeLanguage } from "../../../translate/i18n";
import {
  formatCivilDueDate,
  formatStoreCreditInstallmentPreviewLine,
} from "../storeCreditInstallmentDisplay";

describe("storeCreditInstallmentDisplay", () => {
  it("formata data civil sem new Date (sem risco UTC)", () => {
    expect(formatCivilDueDate("2026-10-09", "pt")).toBe("09/10/2026");
    expect(formatCivilDueDate("2026-10-09", "es")).toBe("09/10/2026");
    expect(formatCivilDueDate("2026-10-09", "en")).toBe("10/09/2026");
    expect(formatCivilDueDate("not-a-date", "pt")).toBe("not-a-date");
  });

  it("pt: Parcela N · DD/MM/AAAA · valor (sem #)", async () => {
    await changeLanguage("pt");
    const line = formatStoreCreditInstallmentPreviewLine({
      sequence: 1,
      dueDate: "2026-10-09",
      amount: 5.98,
    });
    expect(line).not.toMatch(/#1/);
    expect(line).toContain("Parcela 1");
    expect(line).toContain("09/10/2026");
    expect(line).toMatch(/R\$\s*5,98/);
  });

  it("en / es localizam o rótulo", async () => {
    await changeLanguage("en");
    expect(
      formatStoreCreditInstallmentPreviewLine(
        { sequence: 2, dueDate: "2026-11-09", amount: 5.98 },
        { language: "en" }
      )
    ).toMatch(/^Installment 2 · 11\/09\/2026/);

    await changeLanguage("es");
    expect(
      formatStoreCreditInstallmentPreviewLine(
        { sequence: 3, dueDate: "2026-12-09", amount: 5.98 },
        { language: "es" }
      )
    ).toMatch(/^Cuota 3 · 09\/12\/2026/);
  });

  it("não altera o schedule financeiro — só formata campos existentes", () => {
    const inst = { sequence: 1, dueDate: "2026-10-09", amount: 5.98 };
    formatStoreCreditInstallmentPreviewLine(inst);
    expect(inst).toEqual({
      sequence: 1,
      dueDate: "2026-10-09",
      amount: 5.98,
    });
  });
});
