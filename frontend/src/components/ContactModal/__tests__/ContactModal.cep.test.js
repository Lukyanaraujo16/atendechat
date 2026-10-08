/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";

import { changeLanguage } from "../../../translate/i18n";
import { AuthContext } from "../../../context/Auth/AuthContext";
import ContactModal from "../index";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    isCancel: () => false,
  },
}));

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock("../../../errors/toastError", () => jest.fn());
jest.mock("../../../errors/feedbackToasts", () => ({
  showSuccessToast: jest.fn(),
}));

jest.mock("../../../utils/canManageContactAssignments", () => ({
  canManageContactAssignments: () => false,
}));

const api = require("../../../services/api").default;

const theme = createTheme();

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{ user: { id: 1, profile: "user", companyId: 1 } }}
      >
        <ThemeProvider theme={theme}>
          <ContactModal open onClose={jest.fn()} {...props} />
        </ThemeProvider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe("ContactModal ViaCEP", () => {
  beforeEach(() => {
    changeLanguage("pt");
    jest.clearAllMocks();
    jest.useFakeTimers();
    api.get.mockResolvedValue({ data: [] });
    axios.get.mockResolvedValue({
      data: {
        cep: "29100-000",
        logradouro: "Rua Exemplo",
        complemento: "lado ímpar",
        bairro: "Centro",
        localidade: "Vila Velha",
        uf: "ES",
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("não consulta ao montar com CEP existente", async () => {
    api.get.mockImplementation((url) => {
      if (String(url).includes("/contacts/")) {
        return Promise.resolve({
          data: {
            id: 9,
            name: "Cliente",
            number: "5527999999999",
            email: "",
            notes: "",
            postalCode: "29100-000",
            street: "Rua Histórica",
            addressNumber: "10",
            addressComplement: "Casa",
            district: "Centro",
            city: "Vila Velha",
            state: "ES",
            extraInfo: [],
            tags: [],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderModal({ contactId: 9 });
    await waitFor(() =>
      expect(screen.getByTestId("contact-field-street").value).toBe(
        "Rua Histórica"
      )
    );
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("digitar CEP completo faz autofill e preserva número/complemento", async () => {
    renderModal();
    const cep = await screen.findByTestId("contact-field-postalCode");
    const number = screen.getByTestId("contact-field-addressNumber");
    const complement = screen.getByTestId("contact-field-addressComplement");

    fireEvent.change(number, { target: { value: "123" } });
    fireEvent.change(complement, { target: { value: "Apto 201" } });
    fireEvent.change(cep, { target: { value: "29100-000" } });

    act(() => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() =>
      expect(screen.getByTestId("contact-field-street").value).toBe(
        "Rua Exemplo"
      )
    );
    expect(screen.getByTestId("contact-field-city").value).toBe("Vila Velha");
    expect(screen.getByTestId("contact-field-state").value).toBe("ES");
    expect(number.value).toBe("123");
    expect(complement.value).toBe("Apto 201");
  });
});
