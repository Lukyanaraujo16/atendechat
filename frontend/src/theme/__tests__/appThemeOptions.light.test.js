import { getThemeOptions, BRAND_PRIMARY, LIGHT_CANVAS, LIGHT_PAPER, LIGHT_SIDEBAR, LIGHT_TEXT_PRIMARY, LIGHT_TEXT_SECONDARY, LIGHT_DIVIDER } from "../appThemeOptions";
import {
  getChatBodySurface,
  getComposerSurface,
  getInboxCardSurface,
  getInboxListSurface,
} from "../ticketPanelStyles";

describe("tema claro", () => {
  const light = getThemeOptions("light");
  const dark = getThemeOptions("dark");

  it("separa canvas, sidebar e cards sem trocar o verde da marca", () => {
    expect(light.palette.background.default).toBe(LIGHT_CANVAS);
    expect(light.palette.background.paper).toBe(LIGHT_PAPER);
    expect(light.palette.sidebar).toBe(LIGHT_SIDEBAR);
    expect(light.palette.text.primary).toBe(LIGHT_TEXT_PRIMARY);
    expect(light.palette.text.secondary).toBe(LIGHT_TEXT_SECONDARY);
    expect(light.palette.divider).toBe(LIGHT_DIVIDER);
    expect(light.palette.primary.main).toBe(BRAND_PRIMARY);
    expect(light.palette.error.main).toBe("#d32f2f");
    expect(light.overrides.MuiPaper.elevation1.boxShadow).not.toContain("15, 23, 42");
  });

  it("preserva o tema escuro", () => {
    expect(dark.palette.background.default).toBe("#121212");
    expect(dark.palette.background.paper).toBe("#1e1e1e");
    expect(dark.palette.sidebar).toBe("#1e1e1e");
    expect(dark.palette.text.primary).toBe("#ffffff");
    expect(dark.palette.text.secondary).toBe("rgba(255, 255, 255, 0.7)");
    expect(dark.palette.divider).toBe("rgba(255, 255, 255, 0.12)");
    expect(dark.palette.primary.main).toBe(BRAND_PRIMARY);
    expect(dark.palette.error.main).toBe("#f44336");
    expect(dark.overrides.MuiPaper.elevation1.boxShadow).toBe(
      "0 10px 30px rgba(0,0,0,0.7)"
    );
    expect(dark.overrides.MuiDialog.paper.border).toBeUndefined();
    expect(dark.overrides.MuiMenu.paper).toEqual({});
  });

  it("aplica o canvas claro só nas superfícies de atendimento, preservando o escuro", () => {
    const lightTheme = { palette: { type: "light" } };
    const darkTheme = { palette: { type: "dark" } };
    expect(getInboxListSurface(lightTheme)).toBe(LIGHT_CANVAS);
    expect(getChatBodySurface(lightTheme)).toBe(LIGHT_CANVAS);
    expect(getInboxCardSurface(lightTheme)).toBe(LIGHT_PAPER);
    expect(getComposerSurface(lightTheme)).toBe(LIGHT_PAPER);
    expect(getInboxListSurface(darkTheme)).toBe("#161616");
    expect(getChatBodySurface(darkTheme)).toBe("#161616");
    expect(getInboxCardSurface(darkTheme)).toBe("#191919");
    expect(getComposerSurface(darkTheme)).toBe("#191919");
  });
});
