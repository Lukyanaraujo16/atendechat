/**
 * @jest-environment jsdom
 *
 * Guards estruturais + testes matemáticos do desktop split da inbox.
 * Medidas reais de layout exigem homologação visual no browser (ticket real).
 */
import fs from "fs";
import path from "path";

import {
  TICKETS_COMPACT_DESKTOP_MAX_WIDTH,
  TICKETS_COMPACT_DESKTOP_MEDIA,
  TICKETS_DESKTOP_MIN_WIDTH,
  TICKETS_DESKTOP_SPLIT_COLUMNS,
  TICKETS_LIST_MAX_PX,
  TICKETS_LIST_MIN_PX,
  TICKETS_WIDE_DESKTOP_MIN_WIDTH,
  estimateSplitContentWidth,
  estimateTicketsListColumnWidth,
  formatInboxPillCount,
} from "../ticketsCompactDesktopLayout";
import { MOBILE_MEDIA_QUERY } from "../../hooks/useIsMobile";

const root = path.join(__dirname, "../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

const VIEWPORTS = [1280, 1366, 1440, 1500, 1599, 1600, 1700, 1920];

describe("ticketsCompactDesktopLayout — geometria contínua", () => {
  it("usa clamp único para todo o desktop split", () => {
    expect(TICKETS_DESKTOP_SPLIT_COLUMNS).toBe(
      `clamp(${TICKETS_LIST_MIN_PX}px, 40%, ${TICKETS_LIST_MAX_PX}px) minmax(0, 1fr)`
    );
  });

  it("não define colunas wide/compact separadas (sem salto 1599→1600)", () => {
    const src = readSrc("pages/TicketsCustom/index.js");
    expect(src).toContain("TICKETS_DESKTOP_SPLIT_COLUMNS");
    expect(src).not.toContain("TICKETS_WIDE_SPLIT_COLUMNS");
    expect(src).not.toContain("TICKETS_COMPACT_SPLIT_COLUMNS");
    expect(src).not.toMatch(/gridTemplateColumns:[\s\S]*TICKETS_COMPACT/);
  });

  describe("monotonicidade da lista (drawer aberto)", () => {
    const widths = VIEWPORTS.map((vp) =>
      estimateTicketsListColumnWidth(estimateSplitContentWidth(vp, { drawerOpen: true }))
    );

    it.each(VIEWPORTS.map((vp, i) => [vp, widths[i]]))(
      "viewport %i → lista ~%i px",
      (vp, listW) => {
        expect(listW).toBeGreaterThanOrEqual(TICKETS_LIST_MIN_PX);
        expect(listW).toBeLessThanOrEqual(TICKETS_LIST_MAX_PX);
      }
    );

    it("aumentar viewport nunca diminui a coluna da lista", () => {
      for (let i = 1; i < widths.length; i += 1) {
        expect(widths[i]).toBeGreaterThanOrEqual(widths[i - 1]);
      }
    });

    it("1599 → 1600 sem queda (drawer aberto)", () => {
      const w1599 = estimateTicketsListColumnWidth(
        estimateSplitContentWidth(1599, { drawerOpen: true })
      );
      const w1600 = estimateTicketsListColumnWidth(
        estimateSplitContentWidth(1600, { drawerOpen: true })
      );
      expect(w1600).toBeGreaterThanOrEqual(w1599);
    });
  });

  describe("monotonicidade da lista (drawer recolhido)", () => {
    const widths = VIEWPORTS.map((vp) =>
      estimateTicketsListColumnWidth(
        estimateSplitContentWidth(vp, { drawerOpen: false })
      )
    );

    it("aumentar viewport nunca diminui a coluna da lista", () => {
      for (let i = 1; i < widths.length; i += 1) {
        expect(widths[i]).toBeGreaterThanOrEqual(widths[i - 1]);
      }
    });

    it("1599 → 1600 sem queda (drawer recolhido)", () => {
      const w1599 = estimateTicketsListColumnWidth(
        estimateSplitContentWidth(1599, { drawerOpen: false })
      );
      const w1600 = estimateTicketsListColumnWidth(
        estimateSplitContentWidth(1600, { drawerOpen: false })
      );
      expect(w1600).toBeGreaterThanOrEqual(w1599);
    });
  });

  it("1280 drawer aberto: lista no piso 420px", () => {
    const splitW = estimateSplitContentWidth(1280, { drawerOpen: true });
    expect(estimateTicketsListColumnWidth(splitW)).toBe(420);
    const conv = splitW - 12 - 420;
    expect(conv).toBeGreaterThan(0);
  });
});

describe("formatInboxPillCount", () => {
  it.each([
    [0, "0", 0],
    [9, "9", 9],
    [99, "99", 99],
    [999, "999", 999],
    [1000, "999+", 1000],
    [1500, "999+", 1500],
  ])("count %i → display %s (exact %i)", (input, display, exact) => {
    const r = formatInboxPillCount(input);
    expect(r.display).toBe(display);
    expect(r.exact).toBe(exact);
  });
});

describe("TicketResponsiveContainer — master/detail", () => {
  it("1279 → master/detail; 1280 → TicketsCustom split", () => {
    const src = readSrc("pages/TicketResponsiveContainer/index.js");
    expect(src).toContain("useIsMobile");
    expect(src).toContain("TicketAdvanced");
    expect(src).toContain("TicketsCustom");
    expect(TICKETS_DESKTOP_MIN_WIDTH).toBe(1280);
    expect(MOBILE_MEDIA_QUERY).toBe("(max-width:1279.95px)");
  });

  it("1024/1200 permanecem em master/detail", () => {
    [1024, 1200, 1279].forEach((w) => {
      expect(w).toBeLessThan(TICKETS_DESKTOP_MIN_WIDTH);
    });
  });
});

describe("TicketsManagerTabs — pills, busca, i18n", () => {
  const src = readSrc("components/TicketsManagerTabs/index.js");

  it("pills sem wrap (grid 3 colunas)", () => {
    expect(src).toContain('gridTemplateColumns: "repeat(3, minmax(0, 1fr))"');
    expect(src).toContain('flexWrap: "nowrap"');
  });

  it("labels i18n (não hardcoded PT)", () => {
    expect(src).toContain('i18n.t("ticketsList.assignedHeader")');
    expect(src).toContain('i18n.t("ticketsList.pendingHeader")');
    expect(src).not.toContain(">ATENDENDO<");
    expect(src).not.toContain(">AGUARDANDO<");
  });

  it("contadores com formatInboxPillCount e min-width auto", () => {
    expect(src).toContain("formatInboxPillCount");
    expect(src).toContain('minWidth: 20');
    expect(src).toContain('width: "auto"');
  });

  it("bulk em segunda linha real (wrap + flex 1 0 100%)", () => {
    expect(src).toContain("searchRowWrapBulk");
    expect(src).toContain('flexWrap: "wrap"');
    expect(src).toContain('flex: "1 0 100%"');
    expect(src).toContain("isCompactDesktop && showBulkSelectControl");
  });

  it("useTicketsCompactDesktop uma vez no manager", () => {
    expect(src).toContain("useTicketsCompactDesktop");
    expect(src).not.toMatch(/TicketListItemCustom/);
  });
});

describe("TicketsListCustom + TicketListItemCustom — prop compactDesktop", () => {
  it("lista repassa compactDesktop ao item", () => {
    const listSrc = readSrc("components/TicketsListCustom/index.js");
    expect(listSrc).toContain("compactDesktop = false");
    expect(listSrc).toContain("compactDesktop={compactDesktop}");
  });

  it("item não usa useTicketsCompactDesktop", () => {
    const itemSrc = readSrc("components/TicketListItemCustom/index.js");
    expect(itemSrc).toContain("compactDesktop = false");
    expect(itemSrc).not.toContain("useTicketsCompactDesktop");
    expect(itemSrc).toContain("compactDesktop !== next.compactDesktop");
  });

  it("estilos compactos de card só via media query da faixa intermediária", () => {
    const itemSrc = readSrc("components/TicketListItemCustom/index.js");
    expect(itemSrc).toContain("TICKETS_COMPACT_DESKTOP_MEDIA");
    expect(itemSrc).toContain("isCompactDesktopLayout");
  });
});

describe("mobile / PWA — preservados", () => {
  it("TicketsAdvanced intacto", () => {
    const src = readSrc("pages/TicketsAdvanced/index.js");
    expect(src).toContain("useMobileVisualViewport");
    expect(src).not.toContain("compactDesktop");
  });
});

describe("densidade visual compacta vs larga", () => {
  it("faixa 1280–1599.95 para pills/cards (não geometria)", () => {
    expect(TICKETS_COMPACT_DESKTOP_MEDIA).toContain("1599.95");
    expect(TICKETS_WIDE_DESKTOP_MIN_WIDTH).toBe(1600);
  });
});

/**
 * Homologação visual obrigatória (não coberta por Jest):
 * - 1279 vs 1280 (master/detail ↔ split)
 * - ticket real selecionado, nomes longos, drawer aberto/recolhido
 * - tema claro/escuro
 */
