/**
 * @jest-environment jsdom
 *
 * WhatsAppModal — seletor de provider no CREATE para quem gerencia conexões.
 */
/* eslint-disable import/first */
import React from "react";
import { render, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../../../context/Auth/AuthContext";

const mockUsePlanFlags = jest.fn();

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock("../../../hooks/useFeature", () => ({
  __esModule: true,
  default: () => ({ enabled: false, loaded: true }),
}));

jest.mock("../../../hooks/useIsMobile", () => ({
  __esModule: true,
  default: () => false,
}));

jest.mock("../../../hooks/usePlanFlags", () => ({
  __esModule: true,
  default: (...args) => mockUsePlanFlags(...args),
}));

jest.mock("../../QueueSelect", () => ({
  __esModule: true,
  default: () => null,
}));

import WhatsAppModal from "../index";

const theme = createTheme();

function connectionsOn() {
  mockUsePlanFlags.mockReturnValue({
    loaded: true,
    effectiveFeatures: { "settings.connections": true },
  });
}

function connectionsOff() {
  mockUsePlanFlags.mockReturnValue({
    loaded: true,
    effectiveFeatures: { "settings.connections": false },
  });
}

function renderModal(user, { whatsAppId } = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <AuthContext.Provider value={{ user }}>
          <WhatsAppModal open onClose={jest.fn()} whatsAppId={whatsAppId} />
        </AuthContext.Provider>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("WhatsAppModal — provider UI CREATE/EDIT", () => {
  beforeEach(() => {
    connectionsOn();
  });

  it("usuário sem settings.connections não vê seletor", async () => {
    connectionsOff();
    renderModal({ id: 1, profile: "user", companyId: 1, super: false });
    expect(
      screen.queryByTestId("whatsapp-connection-provider-select")
    ).toBeNull();
  });

  it("Super Admin autorizado vê seletor no create", async () => {
    renderModal({ id: 1, profile: "admin", companyId: 1, super: true });
    expect(
      screen.getByTestId("whatsapp-connection-provider-select")
    ).toBeTruthy();
  });

  it("Admin tenant com settings.connections vê seletor no create", async () => {
    renderModal({ id: 2, profile: "admin", companyId: 1, super: false });
    expect(
      screen.getByTestId("whatsapp-connection-provider-select")
    ).toBeTruthy();
  });

  it("supervisor com permissão efetiva vê seletor no create", async () => {
    renderModal({ id: 3, profile: "supervisor", companyId: 1, super: false });
    expect(
      screen.getByTestId("whatsapp-connection-provider-select")
    ).toBeTruthy();
  });

  it("user com permissão efetiva vê seletor no create", async () => {
    renderModal({ id: 4, profile: "user", companyId: 1, super: false });
    expect(
      screen.getByTestId("whatsapp-connection-provider-select")
    ).toBeTruthy();
  });

  it("edit não mostra seletor; Super Admin vê chip read-only", async () => {
    const api = require("../../../services/api").default;
    api.get.mockImplementation((url) => {
      if (String(url).includes("whatsapp/9")) {
        return Promise.resolve({
          data: {
            id: 9,
            name: "EditMe",
            connectionProvider: "evolution",
            queues: [],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    renderModal(
      { id: 1, profile: "admin", companyId: 1, super: true },
      { whatsAppId: 9 }
    );
    expect(
      screen.queryByTestId("whatsapp-connection-provider-select")
    ).toBeNull();
  });

  it("edit mostra chip read-only para quem gerencia conexões", async () => {
    const api = require("../../../services/api").default;
    api.get.mockImplementation((url) => {
      if (String(url).includes("whatsapp/9")) {
        return Promise.resolve({
          data: {
            id: 9,
            name: "EditMe",
            connectionProvider: "evolution",
            queues: [],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    renderModal(
      { id: 2, profile: "admin", companyId: 1, super: false },
      { whatsAppId: 9 }
    );
    expect(
      screen.queryByTestId("whatsapp-connection-provider-select")
    ).toBeNull();
    expect(
      screen.getByTestId("whatsapp-connection-provider-readonly")
    ).toBeTruthy();
  });
});
