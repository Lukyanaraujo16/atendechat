import {
  KEYBOARD_OPEN_THRESHOLD_PX,
  TICKET_CONVERSATION_MOBILE_CLASS,
  TICKET_KEYBOARD_OPEN_CLASS,
  applyMobileVisualViewportToDocument,
  readMobileVisualViewport,
  viewportStatesEqual,
} from "../mobileVisualViewport";

describe("mobileVisualViewport", () => {
  it("usa visualViewport quando disponível", () => {
    const state = readMobileVisualViewport({
      visualHeight: 500,
      layoutHeight: 800,
      offsetTop: 0,
      offsetLeft: 0,
      hasVisualViewport: true,
    });
    expect(state.hasVisualViewport).toBe(true);
    expect(state.height).toBe(500);
    expect(state.bottomInset).toBe(300);
    expect(state.keyboardLikelyOpen).toBe(true);
    expect(KEYBOARD_OPEN_THRESHOLD_PX).toBeGreaterThan(50);
  });

  it("fallback sem visualViewport", () => {
    const state = readMobileVisualViewport({
      visualHeight: 700,
      layoutHeight: 700,
      offsetTop: 0,
      offsetLeft: 0,
      hasVisualViewport: false,
    });
    expect(state.hasVisualViewport).toBe(false);
    expect(state.keyboardLikelyOpen).toBe(false);
    expect(state.height).toBe(700);
  });

  it("detecta teclado fechado quando inset pequeno", () => {
    const state = readMobileVisualViewport({
      visualHeight: 780,
      layoutHeight: 800,
      offsetTop: 0,
      hasVisualViewport: true,
    });
    expect(state.keyboardLikelyOpen).toBe(false);
  });

  it("considera offsetTop no cálculo do inset", () => {
    const state = readMobileVisualViewport({
      visualHeight: 500,
      layoutHeight: 800,
      offsetTop: 200,
      hasVisualViewport: true,
    });
    expect(state.bottomInset).toBe(100);
    expect(state.keyboardLikelyOpen).toBe(false);
  });

  it("viewportStatesEqual evita re-render desnecessário", () => {
    const a = readMobileVisualViewport({
      visualHeight: 500,
      layoutHeight: 800,
      offsetTop: 0,
      hasVisualViewport: true,
    });
    const b = { ...a };
    expect(viewportStatesEqual(a, b)).toBe(true);
    expect(viewportStatesEqual(a, { ...a, height: 499 })).toBe(false);
  });

  it("applyMobileVisualViewportToDocument define vars e classes", () => {
    applyMobileVisualViewportToDocument(
      {
        height: 640,
        offsetTop: 12,
        bottomInset: 200,
        keyboardLikelyOpen: true,
      },
      { active: true }
    );
    expect(
      document.documentElement.classList.contains(TICKET_CONVERSATION_MOBILE_CLASS)
    ).toBe(true);
    expect(
      document.documentElement.classList.contains(TICKET_KEYBOARD_OPEN_CLASS)
    ).toBe(true);
    expect(
      document.documentElement.getAttribute("data-app-vv-height")
    ).toBe("640px");
    expect(
      document.documentElement.getAttribute("data-app-vv-offset-top")
    ).toBe("12px");

    applyMobileVisualViewportToDocument({}, { active: false });
    expect(
      document.documentElement.classList.contains(TICKET_CONVERSATION_MOBILE_CLASS)
    ).toBe(false);
    expect(document.documentElement.getAttribute("data-app-vv-height")).toBeNull();
  });

  it("cleanup remove classes de teclado", () => {
    applyMobileVisualViewportToDocument(
      { height: 400, offsetTop: 0, bottomInset: 300, keyboardLikelyOpen: true },
      { active: true }
    );
    applyMobileVisualViewportToDocument(
      { height: 800, offsetTop: 0, bottomInset: 0, keyboardLikelyOpen: false },
      { active: true }
    );
    expect(
      document.documentElement.classList.contains(TICKET_KEYBOARD_OPEN_CLASS)
    ).toBe(false);
    applyMobileVisualViewportToDocument({}, { active: false });
  });
});
