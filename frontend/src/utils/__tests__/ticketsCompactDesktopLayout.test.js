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
  TICKETS_DESKTOP_SPLIT_MEDIA,
  TICKETS_CONVERSATION_OVERFLOW_MAX_PX,
  TICKETS_CHAT_CONTAINER_PADDING_PX,
  TICKETS_LIST_MAX_PX,
  TICKETS_LIST_MIN_PX,
  TICKETS_WIDE_DESKTOP_MIN_WIDTH,
  estimateConversationColumnWidth,
  estimateSplitContentWidth,
  estimateTicketsListColumnWidth,
  formatInboxPillCount,
  shouldUseDesktopConversationOverflow,
} from "../ticketsCompactDesktopLayout";
import { MODULE_TABS_HORIZONTAL_PADDING_PX } from "../../layout/layoutConstants";
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

  it("pills sem wrap no desktop split (grid 3 colunas, TICKETS_DESKTOP_SPLIT_MEDIA)", () => {
    expect(src).toContain("TICKETS_DESKTOP_SPLIT_MEDIA");
    expect(src).toContain('gridTemplateColumns: "repeat(3, minmax(0, 1fr))"');
    expect(src).toContain('flexWrap: "nowrap"');
    expect(src).toContain("isDesktopSplit");
    expect(src).toContain('i18n.t("tickets.inbox.automations.short")');
  });

  it("pills não dependem de compactDesktop para grid (separado da densidade de cards)", () => {
    const rowStart = src.indexOf("statusPillsRow:");
    const rowEnd = src.indexOf("statusPill:", rowStart);
    const pillsRowBlock = src.slice(rowStart, rowEnd);
    expect(pillsRowBlock).toContain("TICKETS_DESKTOP_SPLIT_MEDIA");
    expect(pillsRowBlock).not.toContain("TICKETS_COMPACT_DESKTOP_MEDIA");
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
  it("faixa 1280–1599.95 para densidade de cards (não pills/grid)", () => {
    expect(TICKETS_COMPACT_DESKTOP_MEDIA).toContain("1599.95");
    expect(TICKETS_WIDE_DESKTOP_MIN_WIDTH).toBe(1600);
    expect(TICKETS_DESKTOP_SPLIT_MEDIA).toBe("(min-width: 1280px)");
  });
});

describe("desktop split — pills uma linha em viewports comuns", () => {
  const PILL_VIEWPORTS = [1280, 1366, 1440, 1600, 1920];

  it.each(PILL_VIEWPORTS)(
    "viewport %i: lista limitada a máx %i px (pills cabem em grid 3 col)",
    (vp) => {
      const listW = estimateTicketsListColumnWidth(
        estimateSplitContentWidth(vp, { drawerOpen: true })
      );
      expect(listW).toBeLessThanOrEqual(TICKETS_LIST_MAX_PX);
      expect(listW).toBeGreaterThanOrEqual(TICKETS_LIST_MIN_PX);
    }
  );

  it("lista nunca ultrapassa 520px mesmo em 1920", () => {
    const listW = estimateTicketsListColumnWidth(
      estimateSplitContentWidth(1920, { drawerOpen: true })
    );
    expect(listW).toBe(TICKETS_LIST_MAX_PX);
  });
});

describe("header conversa — overflow desktop", () => {
  it("estimateSplitContentWidth inclui padding ModuleTabs + chatContainer", () => {
    expect(MODULE_TABS_HORIZONTAL_PADDING_PX).toBe(32);
    expect(TICKETS_CHAT_CONTAINER_PADDING_PX).toBe(16);
    expect(estimateSplitContentWidth(1600, { drawerOpen: true })).toBe(
      1600 - 299 - MODULE_TABS_HORIZONTAL_PADDING_PX - TICKETS_CHAT_CONTAINER_PADDING_PX
    );
  });

  const OVERFLOW_VIEWPORTS_DRAWER_OPEN = [1280, 1366, 1440, 1600];
  const OVERFLOW_VIEWPORTS_DRAWER_CLOSED = [1280, 1366, 1440];

  it.each(OVERFLOW_VIEWPORTS_DRAWER_OPEN)(
    "viewport %i drawer aberto → overflow",
    (vp) => {
      const conv = estimateConversationColumnWidth(vp, { drawerOpen: true });
      expect(conv).toBeLessThan(TICKETS_CONVERSATION_OVERFLOW_MAX_PX);
      expect(shouldUseDesktopConversationOverflow(vp, { drawerOpen: true })).toBe(
        true
      );
    }
  );

  it.each(OVERFLOW_VIEWPORTS_DRAWER_CLOSED)(
    "viewport %i drawer recolhido → overflow",
    (vp) => {
      const conv = estimateConversationColumnWidth(vp, { drawerOpen: false });
      expect(conv).toBeLessThan(TICKETS_CONVERSATION_OVERFLOW_MAX_PX);
      expect(shouldUseDesktopConversationOverflow(vp, { drawerOpen: false })).toBe(
        true
      );
    }
  );

  it("1600 drawer aberto → overflow; recolhido → inline", () => {
    expect(shouldUseDesktopConversationOverflow(1600, { drawerOpen: true })).toBe(
      true
    );
    expect(shouldUseDesktopConversationOverflow(1600, { drawerOpen: false })).toBe(
      false
    );
    expect(
      estimateConversationColumnWidth(1600, { drawerOpen: false })
    ).toBeGreaterThanOrEqual(TICKETS_CONVERSATION_OVERFLOW_MAX_PX);
  });

  it("1920 drawer aberto e recolhido → inline", () => {
    expect(shouldUseDesktopConversationOverflow(1920, { drawerOpen: true })).toBe(
      false
    );
    expect(shouldUseDesktopConversationOverflow(1920, { drawerOpen: false })).toBe(
      false
    );
    expect(
      estimateConversationColumnWidth(1920, { drawerOpen: true })
    ).toBeGreaterThanOrEqual(TICKETS_CONVERSATION_OVERFLOW_MAX_PX);
    expect(
      estimateConversationColumnWidth(1920, { drawerOpen: false })
    ).toBeGreaterThanOrEqual(TICKETS_CONVERSATION_OVERFLOW_MAX_PX);
  });

  it("drawer recolhido amplia coluna da conversa vs aberto", () => {
    [1280, 1366, 1440, 1600, 1920].forEach((vp) => {
      const openW = estimateConversationColumnWidth(vp, { drawerOpen: true });
      const closedW = estimateConversationColumnWidth(vp, { drawerOpen: false });
      expect(closedW).toBeGreaterThan(openW);
    });
  });

  it("hook overflow lê drawer real via useMainDrawerOpen", () => {
    const hookSrc = readSrc("hooks/useDesktopConversationActionOverflow.js");
    expect(hookSrc).toContain("useMainDrawerOpen");
    expect(hookSrc).not.toContain("drawerOpen: true");
    const layoutSrc = readSrc("layout/index.js");
    expect(layoutSrc).toContain("MainDrawerLayoutProvider");
    expect(layoutSrc).toContain("drawerOpen={drawerOpen}");
  });
});

describe("TicketInfo + TicketConversationActionBar — guards estruturais header", () => {
  it("avatar com flexShrink 0 e identificação com minWidth", () => {
    const infoSrc = readSrc("components/TicketInfo/index.js");
    expect(infoSrc).toContain("flexShrink: 0");
    expect(infoSrc).toMatch(/headerMain:[\s\S]*minWidth/);
  });

  it("action bar usa overflow desktop separado de useIsMobile", () => {
    const barSrc = readSrc("components/TicketConversationActionBar/index.js");
    expect(barSrc).toContain("useDesktopConversationActionOverflow");
    expect(barSrc).toContain("useOverflowMenu");
    expect(barSrc).toContain('data-overflow-menu');
  });

  it("dialog owners Tags/CRM montados em mobile ou desktop overflow", () => {
    const btnSrc = readSrc("components/TicketActionButtonsCustom/index.js");
    expect(btnSrc).toContain("needsDialogOwners");
    expect(btnSrc).toContain("useDesktopConversationActionOverflow");
    expect(btnSrc).toContain("ticket-mobile-dialog-owners");
  });
});

/**
 * Homologação visual obrigatória (não coberta por Jest):
 * - 1279 vs 1280 (master/detail ↔ split)
 * - ticket real selecionado, nomes longos, drawer aberto/recolhido
 * - tema claro/escuro
 */
