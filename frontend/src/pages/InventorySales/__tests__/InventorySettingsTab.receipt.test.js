/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import InventorySettingsTab from "../InventorySettingsTab";
import InventorySales from "../index";
import {
  getInventorySettings,
  updateInventorySettings,
} from "../../../services/inventoryApi";
import toastError from "../../../errors/toastError";

class MutationObserverMock {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MutationObserverMock;

const mockPerms = {
  canView: false,
  canManageProducts: false,
  canManageStock: false,
  canCreateSale: false,
  canViewReports: false,
  canManageSettings: false,
};

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => mockPerms,
}));

jest.mock("../../../services/inventoryApi", () => ({
  getInventorySettings: jest.fn(),
  updateInventorySettings: jest.fn(),
  getInventoryReceiptBranding: jest.fn(() => Promise.resolve({ data: {} })),
  listInventoryProducts: jest.fn(() => Promise.resolve({ data: [] })),
  listInventoryCategories: jest.fn(() => Promise.resolve({ data: [] })),
  listLowStockProducts: jest.fn(() => Promise.resolve({ data: [] })),
  listInventorySales: jest.fn(() => Promise.resolve({ data: [] })),
}));

jest.mock("../../../errors/toastError", () => jest.fn());

jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

const theme = createTheme();

const savedSettings = {
  defaultCommissionRate: 8,
  allowNegativeStock: true,
  saleNumberPrefix: "VD",
  receiptTradeName: "Loja ABC",
  receiptLegalName: "Loja ABC LTDA",
  receiptDocument: "12.345.678/0001-90",
  receiptPhone: "+55 27 99999-9999",
  receiptAddress: "Rua X, 123",
  receiptFooterMessage: "Obrigado.",
};

function renderTab() {
  return render(
    <ThemeProvider theme={theme}>
      <InventorySettingsTab />
    </ThemeProvider>
  );
}

beforeEach(() => {
  changeLanguage("pt");
  mockPerms.canView = false;
  mockPerms.canManageSettings = false;
  getInventorySettings.mockReset();
  updateInventorySettings.mockReset();
  toastError.mockReset();
  getInventorySettings.mockResolvedValue({ data: savedSettings });
  updateInventorySettings.mockResolvedValue({ data: savedSettings });
});

describe("InventorySettings dados do recibo", () => {
  it("não mostra a seção sem permissão de configurações", () => {
    render(<InventorySales />);
    expect(screen.queryByRole("tab", { name: "Configurações" })).toBeNull();
    expect(screen.queryByText("Dados do recibo")).toBeNull();
  });

  it("carrega os campos existentes e limita o tamanho", async () => {
    mockPerms.canManageSettings = true;
    renderTab();

    expect(screen.getByText("A carregar…")).toBeTruthy();
    expect(await screen.findByLabelText("Nome fantasia")).toBeTruthy();
    expect(screen.getByLabelText("Nome fantasia").value).toBe("Loja ABC");
    expect(screen.getByLabelText("Razão social").value).toBe("Loja ABC LTDA");
    expect(screen.getByLabelText("CNPJ / Documento").value).toBe("12.345.678/0001-90");
    expect(screen.getByLabelText("Telefone").value).toBe("+55 27 99999-9999");
    expect(screen.getByLabelText("Endereço").value).toBe("Rua X, 123");
    expect(screen.getByLabelText("Mensagem de rodapé").value).toBe("Obrigado.");
    expect(screen.getByLabelText("Nome fantasia").getAttribute("maxLength")).toBe("120");
    expect(screen.getByLabelText("Razão social").getAttribute("maxLength")).toBe("160");
    expect(screen.getByLabelText("CNPJ / Documento").getAttribute("maxLength")).toBe("32");
    expect(screen.getByLabelText("Telefone").getAttribute("maxLength")).toBe("32");
    expect(screen.getByLabelText("Endereço").getAttribute("maxLength")).toBe("255");
    expect(screen.getByLabelText("Mensagem de rodapé").getAttribute("maxLength")).toBe("500");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeTruthy();
  });

  it("salva os textos com trim e preserva a comissão no mesmo envio", async () => {
    renderTab();
    const trade = await screen.findByLabelText("Nome fantasia");
    fireEvent.change(trade, { target: { value: "  Nova Loja  " } });
    fireEvent.change(screen.getByLabelText("Telefone"), {
      target: { value: "  (27) 98888-8888  " },
    });
    fireEvent.change(screen.getByLabelText("Razão social"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(updateInventorySettings).toHaveBeenCalledTimes(1));
    expect(updateInventorySettings).toHaveBeenCalledWith({
      defaultCommissionRate: 8,
      allowNegativeStock: true,
      saleNumberPrefix: "VD",
      receiptTradeName: "Nova Loja",
      receiptLegalName: null,
      receiptDocument: "12.345.678/0001-90",
      receiptPhone: "(27) 98888-8888",
      receiptAddress: "Rua X, 123",
      receiptFooterMessage: "Obrigado.",
    });
  });

  it("mostra erro de carga e erro ao salvar", async () => {
    getInventorySettings.mockRejectedValueOnce(new Error("load-failed"));
    renderTab();
    expect(await screen.findByText("Tentar novamente")).toBeTruthy();
    expect(toastError).toHaveBeenCalled();

    getInventorySettings.mockResolvedValue({ data: savedSettings });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByLabelText("Nome fantasia")).toBeTruthy();

    updateInventorySettings.mockRejectedValueOnce(new Error("save-failed"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(2));
  });
});
