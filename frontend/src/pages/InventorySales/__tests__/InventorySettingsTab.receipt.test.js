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
  uploadInventoryReceiptLogo,
  deleteInventoryReceiptLogo,
} from "../../../services/inventoryApi";
import toastError from "../../../errors/toastError";
import { toast } from "react-toastify";

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
  uploadInventoryReceiptLogo: jest.fn(),
  deleteInventoryReceiptLogo: jest.fn(),
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
  uploadInventoryReceiptLogo.mockReset();
  deleteInventoryReceiptLogo.mockReset();
  toastError.mockReset();
  toast.error.mockReset();
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
      receiptPrintFormat: "a4",
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

  it("mostra A4 quando o formato não vem na resposta e envia a escolha no Guardar", async () => {
    renderTab();
    expect(await screen.findByRole("button", { name: "Térmica 80 mm" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "A4" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByText("Preferências de impressão")).toBeTruthy();
    expect(screen.getByText("Configurações do estoque")).toBeTruthy();
    expect(screen.getByText("Dados do recibo")).toBeTruthy();
    expect(
      screen.getByText(
        "Esse formato será selecionado automaticamente ao abrir um recibo. Você ainda poderá alterá-lo antes de imprimir."
      )
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Térmica 58 mm" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(updateInventorySettings).toHaveBeenCalledTimes(1));
    expect(updateInventorySettings.mock.calls[0][0].receiptPrintFormat).toBe("thermal58");
    expect(updateInventorySettings.mock.calls[0][0].receiptTradeName).toBe("Loja ABC");
    expect(uploadInventoryReceiptLogo).not.toHaveBeenCalled();
  });

  it("carrega 80 mm e 58 mm e mantém o valor depois de salvar", async () => {
    getInventorySettings.mockResolvedValue({
      data: { ...savedSettings, receiptPrintFormat: "thermal80" },
    });
    renderTab();
    expect(
      (await screen.findByRole("button", { name: "Térmica 80 mm" })).getAttribute(
        "aria-pressed"
      )
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Térmica 58 mm" }));
    updateInventorySettings.mockResolvedValue({
      data: { ...savedSettings, receiptPrintFormat: "thermal58" },
    });
    getInventorySettings.mockResolvedValue({
      data: { ...savedSettings, receiptPrintFormat: "thermal58" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(updateInventorySettings.mock.calls[0][0].receiptPrintFormat).toBe("thermal58")
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Térmica 58 mm" }).getAttribute("aria-pressed")).toBe(
        "true"
      )
    );
  });

  it("trata formato desconhecido como A4 e mantém o formulário se o Guardar falhar", async () => {
    getInventorySettings.mockResolvedValue({
      data: { ...savedSettings, receiptPrintFormat: "80mm" },
    });
    renderTab();
    expect(
      (await screen.findByRole("button", { name: "A4" })).getAttribute("aria-pressed")
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Térmica 80 mm" }));
    updateInventorySettings.mockRejectedValueOnce(new Error("save-failed"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Térmica 80 mm" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByLabelText("Nome fantasia").value).toBe("Loja ABC");
  });
});

describe("InventorySettings logo do recibo", () => {
  function fileInput() {
    return document.querySelector('input[type="file"]');
  }

  it("mostra selecionar, o accept e rejeita tipo ou tamanho antes do request", async () => {
    renderTab();
    expect(await screen.findByRole("button", { name: "Selecionar logo" })).toBeTruthy();
    expect(screen.queryByTestId("receipt-logo-preview")).toBeNull();
    expect(fileInput().getAttribute("accept")).toBe("image/png,image/jpeg,image/webp");

    fireEvent.change(fileInput(), {
      target: {
        files: [new File(["<svg></svg>"], "logo.svg", { type: "image/svg+xml" })],
      },
    });
    expect(uploadInventoryReceiptLogo).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();

    toast.error.mockClear();
    fireEvent.change(fileInput(), {
      target: {
        files: [
          new File([new Uint8Array(2 * 1024 * 1024 + 1)], "grande.png", {
            type: "image/png",
          }),
        ],
      },
    });
    expect(uploadInventoryReceiptLogo).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("envia a logo, mostra o preview absoluto e remove depois de confirmar", async () => {
    const stored =
      "/public/inventory-receipts/company-4/11111111-1111-4111-8111-111111111111.png";
    uploadInventoryReceiptLogo.mockResolvedValue({ data: { receiptLogoUrl: stored } });
    deleteInventoryReceiptLogo.mockResolvedValue({ data: { receiptLogoUrl: null } });
    renderTab();
    await screen.findByRole("button", { name: "Selecionar logo" });

    fireEvent.change(fileInput(), {
      target: {
        files: [new File([new Uint8Array([1, 2, 3])], "logo.png", { type: "image/png" })],
      },
    });

    const preview = await screen.findByTestId("receipt-logo-preview");
    expect(uploadInventoryReceiptLogo).toHaveBeenCalledTimes(1);
    expect(preview.getAttribute("src")).toMatch(/^https?:\/\//);
    expect(preview.getAttribute("src")).toContain(stored);
    expect(preview.getAttribute("src").startsWith("/public")).toBe(false);
    expect(preview.style.objectFit).toBe("contain");

    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(screen.getByText("Remover a logo do recibo?")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Remover" }).pop());
    await waitFor(() => expect(deleteInventoryReceiptLogo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId("receipt-logo-preview")).toBeNull());
  });

  it("mantém a logo atual quando o upload falha", async () => {
    const stored =
      "/public/inventory-receipts/company-4/11111111-1111-4111-8111-111111111111.png";
    getInventorySettings.mockResolvedValue({
      data: { ...savedSettings, receiptLogoUrl: stored },
    });
    uploadInventoryReceiptLogo.mockRejectedValue(new Error("upload-failed"));
    renderTab();
    expect(await screen.findByTestId("receipt-logo-preview")).toBeTruthy();
    fireEvent.change(fileInput(), {
      target: {
        files: [new File([new Uint8Array([1])], "nova.png", { type: "image/png" })],
      },
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByTestId("receipt-logo-preview").getAttribute("src")).toContain(stored);
  });
});
