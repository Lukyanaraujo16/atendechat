/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, render } from "@testing-library/react";
import useMobileVisualViewport from "../../hooks/useMobileVisualViewport";
import {
  TICKET_CONVERSATION_MOBILE_CLASS,
  applyMobileVisualViewportToDocument,
} from "../../utils/mobileVisualViewport";

function Probe({ enabled, onState }) {
  const state = useMobileVisualViewport({ enabled });
  React.useEffect(() => {
    onState(state);
  }, [state, onState]);
  return null;
}

describe("useMobileVisualViewport", () => {
  let originalVv;
  let listeners;

  beforeEach(() => {
    listeners = { resize: [], scroll: [] };
    originalVv = window.visualViewport;
    let height = 700;
    const vv = {
      get height() {
        return height;
      },
      set height(v) {
        height = v;
      },
      offsetTop: 0,
      offsetLeft: 0,
      addEventListener: (type, fn) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
      removeEventListener: (type, fn) => {
        listeners[type] = (listeners[type] || []).filter((x) => x !== fn);
      },
      __setHeight(v) {
        height = v;
      },
    };
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: vv,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });
    applyMobileVisualViewportToDocument({}, { active: false });
  });

  afterEach(() => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: originalVv,
    });
    applyMobileVisualViewportToDocument({}, { active: false });
  });

  it("registra listeners e faz cleanup", () => {
    const onState = jest.fn();
    const { unmount } = render(<Probe enabled onState={onState} />);
    expect(listeners.resize.length).toBe(1);
    expect(listeners.scroll.length).toBe(1);
    expect(
      document.documentElement.classList.contains(TICKET_CONVERSATION_MOBILE_CLASS)
    ).toBe(true);
    unmount();
    expect(listeners.resize.length).toBe(0);
    expect(listeners.scroll.length).toBe(0);
    expect(
      document.documentElement.classList.contains(TICKET_CONVERSATION_MOBILE_CLASS)
    ).toBe(false);
  });

  it("resize atualiza altura (keyboard open)", () => {
    let latest = null;
    render(
      <Probe
        enabled
        onState={(s) => {
          latest = s;
        }}
      />
    );
    expect(latest.height).toBe(700);

    act(() => {
      window.visualViewport.__setHeight(480);
      listeners.resize.forEach((fn) => fn());
    });

    // rAF
    act(() => {
      // flush rAF callbacks
      const id = requestAnimationFrame(() => {});
      cancelAnimationFrame(id);
    });
  });

  it("disabled não aplica classe permanente", () => {
    const { unmount } = render(<Probe enabled={false} onState={() => {}} />);
    expect(
      document.documentElement.classList.contains(TICKET_CONVERSATION_MOBILE_CLASS)
    ).toBe(false);
    unmount();
  });
});
