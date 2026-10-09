/**
 * @jest-environment jsdom
 */
import { changeLanguage } from "../../../translate/i18n";
import {
  civilDateFromLocalInstant,
  combineCivilDateWithLocalClockToIso,
  formatCivilDueDate,
  formatStoreCreditInstallmentPreviewLine,
  todayCivilDate,
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

  describe("combineCivilDateWithLocalClockToIso (recebimento)", () => {
    it("atribui hora automática e preserva a data civil escolhida", () => {
      const now = new Date(2026, 9, 9, 8, 56, 30, 0); // 09/10/2026 08:56 local
      const iso = combineCivilDateWithLocalClockToIso("2026-10-09", now);
      expect(iso).toBeTruthy();
      const parsed = new Date(iso);
      expect(civilDateFromLocalInstant(parsed)).toBe("2026-10-09");
      expect(parsed.getHours()).toBe(8);
      expect(parsed.getMinutes()).toBe(56);
      expect(parsed.getSeconds()).toBe(30);
    });

    it("data retroativa permanece no mesmo dia civil com hora atual", () => {
      const now = new Date(2026, 9, 9, 8, 56, 0, 0);
      const iso = combineCivilDateWithLocalClockToIso("2026-10-08", now);
      expect(civilDateFromLocalInstant(iso)).toBe("2026-10-08");
      expect(new Date(iso).getHours()).toBe(8);
      expect(new Date(iso).getMinutes()).toBe(56);
    });

    it("não usa new Date(YYYY-MM-DD) que deslocaria o dia em fuso BR", () => {
      const now = new Date(2026, 9, 9, 8, 56, 0, 0);
      const safe = combineCivilDateWithLocalClockToIso("2026-10-09", now);
      const unsafe = new Date("2026-10-09"); // UTC midnight
      // Em fusos UTC-*, unsafe.getDate() local pode ser 8; o helper não.
      expect(civilDateFromLocalInstant(safe)).toBe("2026-10-09");
      expect(safe).not.toBe(unsafe.toISOString());
    });

    it("todayCivilDate usa componentes locais", () => {
      const now = new Date(2026, 0, 5, 23, 30, 0, 0);
      expect(todayCivilDate(now)).toBe("2026-01-05");
    });
  });
});
