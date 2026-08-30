/**
 * @jest-environment jsdom
 *
 * Cobertura mínima WhatsAppModal Fase 11 via helpers + smoke de seletor.
 * Payload/auth cobertos em whatsappEvolutionUi.test.js.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../../../context/Auth/AuthContext";

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

jest.mock("../../QueueSelect", () => ({
  __esModule: true,
  default: () => null,
}));

import WhatsAppModal from "../index";

const theme = createTheme();

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

describe("WhatsAppModal — provider UI Fase 11", () => {
  it("tenant não vê seletor de tipo de conexão", async () => {
    renderModal({ id: 1, profile: "admin", companyId: 1, super: false });
    expect(
      screen.queryByTestId("whatsapp-connection-provider-select")
    ).toBeNull();
  });

  it("Super Admin vê seletor no create", async () => {
    renderModal({ id: 1, profile: "admin", companyId: 1, super: true });
    expect(
      screen.getByTestId("whatsapp-connection-provider-select")
    ).toBeTruthy();
  });

  it("edit não mostra seletor modificável (apenas read-only se Super Admin)", async () => {
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
});
