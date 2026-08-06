/**
 * AppVersionGate continua montável em contexto standalone (sem regressão).
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import AppVersionGate from "..";

jest.mock("../../../hooks/useAppVersionCheck", () => ({
  __esModule: true,
  default: () => ({
    updateAvailable: false,
    reloadToUpdate: jest.fn(),
    isLikelyUnsavedWork: () => false,
    remoteVersion: null,
  }),
}));

jest.mock("../../../utils/unregisterWorkboxServiceWorker", () => ({
  bootstrapDisableWorkboxServiceWorker: jest.fn(),
}));

describe("AppVersionGate em standalone", () => {
  it("renderiza children com display-mode standalone simulado", () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: String(query).includes("standalone"),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }));

    render(
      <AppVersionGate>
        <div>standalone-child</div>
      </AppVersionGate>
    );
    expect(screen.getByText("standalone-child")).toBeTruthy();
    expect(window.matchMedia("(display-mode: standalone)").matches).toBe(true);
  });
});
