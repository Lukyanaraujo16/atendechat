/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, render } from "@testing-library/react";
import {
  INSTALLATION_STATUS,
  PwaInstallProvider,
  usePwaInstall,
} from "../PwaInstallContext";
import { AuthContext } from "../../Auth/AuthContext";
import {
  buildPwaInstallStorageKey,
  PWA_INSTALL_PROMPT_DELAY_MS,
} from "../../../utils/pwaInstallPersistence";

jest.mock("../../../utils/pwaInstallMetrics", () => ({
  logPwaInstallMetric: jest.fn(),
}));

class MutationObserverMock {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MutationObserverMock;

function Probe({ onValue }) {
  const value = usePwaInstall();
  onValue(value);
  return <span data-testid="probe" />;
}

function renderWithAuth(ui, { user = { id: 10 }, isAuth = true, promptDelayMs = 0 } = {}) {
  return render(
    <AuthContext.Provider value={{ user, isAuth, loading: false }}>
      <PwaInstallProvider promptDelayMs={promptDelayMs}>{ui}</PwaInstallProvider>
    </AuthContext.Provider>
  );
}

function flush() {
  return act(async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("PwaInstallProvider — Android beforeinstallprompt", () => {
  let originalMatchMedia;
  let originalUserAgent;
  let latest;

  beforeEach(() => {
    latest = null;
    originalMatchMedia = window.matchMedia;
    originalUserAgent = navigator.userAgent;

    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () =>
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
    });

    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }));

    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () => originalUserAgent,
    });
  });

  function capture(v) {
    latest = v;
  }

  function dispatchBip({ outcome = "accepted" } = {}) {
    const preventDefault = jest.fn();
    const prompt = jest.fn(async () => undefined);
    const userChoice = Promise.resolve({ outcome });
    const event = new Event("beforeinstallprompt");
    event.preventDefault = preventDefault;
    event.prompt = prompt;
    event.userChoice = userChoice;
    act(() => {
      window.dispatchEvent(event);
    });
    return event;
  }

  it("armazena evento, chama preventDefault e expõe canPromptInstall", async () => {
    renderWithAuth(<Probe onValue={capture} />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    const event = dispatchBip();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(latest.canPromptInstall).toBe(true);
    expect(latest.installationStatus).toBe(INSTALLATION_STATUS.PROMPT_AVAILABLE);
  });

  it("Android sem evento não promete instalação (canPromptInstall false)", () => {
    renderWithAuth(<Probe onValue={capture} />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(latest.canPromptInstall).toBe(false);
  });

  it("clique chama prompt() uma vez; accepted; evento não reutilizado", async () => {
    renderWithAuth(<Probe onValue={capture} />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    const event = dispatchBip({ outcome: "accepted" });
    expect(latest.canPromptInstall).toBe(true);

    let first;
    await act(async () => {
      first = await latest.promptInstall();
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(first.outcome).toBe("accepted");
    expect(latest.canPromptInstall).toBe(false);

    let second;
    await act(async () => {
      second = await latest.promptInstall();
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(second.outcome).toBe("unavailable");
  });

  it("dismissed pelo userChoice", async () => {
    renderWithAuth(<Probe onValue={capture} />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    dispatchBip({ outcome: "dismissed" });

    let result;
    await act(async () => {
      result = await latest.promptInstall();
    });
    expect(result.outcome).toBe("dismissed");
    expect(latest.installationStatus).toBe(INSTALLATION_STATUS.DISMISSED);
  });

  it("appinstalled limpa estado e grava flag", () => {
    renderWithAuth(<Probe onValue={capture} />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    dispatchBip();

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(latest.canPromptInstall).toBe(false);
    expect(latest.installationStatus).toBe(INSTALLATION_STATUS.INSTALLED);
    expect(
      localStorage.getItem(buildPwaInstallStorageKey("installed", "any", 10))
    ).toBe("1");
  });

  it("standalone não mostra experiência de instalação", () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: String(query).includes("standalone"),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }));

    renderWithAuth(<Probe onValue={capture} />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(latest.isStandalone).toBe(true);
    expect(latest.shouldShowInstallExperience).toBe(false);
  });

  it("cleanup remove listeners no unmount", () => {
    const bipHandlers = [];
    const appHandlers = [];
    const originalAdd = window.addEventListener.bind(window);
    const originalRemove = window.removeEventListener.bind(window);
    window.addEventListener = (type, fn, ...rest) => {
      if (type === "beforeinstallprompt") bipHandlers.push(fn);
      if (type === "appinstalled") appHandlers.push(fn);
      return originalAdd(type, fn, ...rest);
    };
    window.removeEventListener = (type, fn, ...rest) => {
      if (type === "beforeinstallprompt") {
        const i = bipHandlers.indexOf(fn);
        if (i >= 0) bipHandlers.splice(i, 1);
      }
      if (type === "appinstalled") {
        const i = appHandlers.indexOf(fn);
        if (i >= 0) appHandlers.splice(i, 1);
      }
      return originalRemove(type, fn, ...rest);
    };

    const { unmount } = renderWithAuth(<Probe onValue={capture} />);
    expect(bipHandlers.length).toBe(1);
    expect(appHandlers.length).toBe(1);
    unmount();
    expect(bipHandlers.length).toBe(0);
    expect(appHandlers.length).toBe(0);

    window.addEventListener = originalAdd;
    window.removeEventListener = originalRemove;
  });

  it("usa delay configurável (promptDelayMs) — referência ao constante", () => {
    expect(PWA_INSTALL_PROMPT_DELAY_MS).toBeGreaterThanOrEqual(5000);
    expect(PWA_INSTALL_PROMPT_DELAY_MS).toBeLessThanOrEqual(15000);
  });
});

describe("PwaInstallProvider — iOS", () => {
  let latest;
  let originalMatchMedia;
  let originalUserAgent;

  beforeEach(() => {
    latest = null;
    originalMatchMedia = window.matchMedia;
    originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () =>
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1",
    });
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }));
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () => originalUserAgent,
    });
  });

  it("iPhone não instalado — plataforma iphone e oferta após delay 0", () => {
    renderWithAuth(
      <Probe
        onValue={(v) => {
          latest = v;
        }}
      />,
      { user: { id: 5 }, promptDelayMs: 0 }
    );
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(latest.platform).toBe("iphone");
    expect(latest.shouldShowInstallExperience).toBe(true);
  });

  it("reopenInstallHelp força instruções (entrada manual iOS)", () => {
    renderWithAuth(
      <Probe
        onValue={(v) => {
          latest = v;
        }}
      />,
      { user: { id: 5 }, promptDelayMs: 60000 }
    );
    expect(latest.shouldShowInstallExperience).toBe(false);
    act(() => {
      latest.reopenInstallHelp();
    });
    expect(latest.shouldShowInstallExperience).toBe(true);
    expect(latest.forceHelpOpen).toBe(true);
  });
});
