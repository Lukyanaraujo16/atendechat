/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, waitFor, act } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import AppVersionGate from "..";

jest.mock("../../../utils/unregisterWorkboxServiceWorker", () => ({
  bootstrapDisableWorkboxServiceWorker: jest.fn(),
}));

describe("AppVersionGate / useAppVersionCheck", () => {
  const theme = createTheme();
  let fetchMock;

  function setMetaVersion(version) {
    let meta = document.querySelector('meta[name="shc-build-version"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "shc-build-version");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", version);
  }

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    window.localStorage.clear();
    window.sessionStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    const meta = document.querySelector('meta[name="shc-build-version"]');
    if (meta) meta.remove();
  });

  function renderGate() {
    return render(
      <ThemeProvider theme={theme}>
        <AppVersionGate>
          <div>app</div>
        </AppVersionGate>
      </ThemeProvider>
    );
  }

  it("versão igual não mostra modal", async () => {
    setMetaVersion("v1");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ version: "v1" }),
    });
    const { queryByText } = renderGate();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(queryByText("Nova versão disponível")).toBeNull();
  });

  it("versão diferente mostra modal uma vez", async () => {
    setMetaVersion("old");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ version: "new" }),
    });
    const { findAllByText } = renderGate();
    const titles = await findAllByText("Nova versão disponível");
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });

  it("polling moderado agenda intervalo", async () => {
    setMetaVersion("v1");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ version: "v1" }),
    });
    renderGate();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      jest.advanceTimersByTime(90_000);
    });
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
  });

  it("visibilitychange dispara check", async () => {
    setMetaVersion("v1");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ version: "v1" }),
    });
    renderGate();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
  });
});
