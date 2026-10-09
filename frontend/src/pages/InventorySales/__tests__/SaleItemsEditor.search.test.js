/**
 * @jest-environment jsdom
 */
import React from "react";
import fs from "fs";
import path from "path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { changeLanguage } from "../../../translate/i18n";
import { toast } from "react-toastify";
import SaleItemsEditor from "../SaleItemsEditor";
import {
  addInventorySaleItem,
  listInventoryProducts,
} from "../../../services/inventoryApi";
import toastError from "../../../errors/toastError";
import useIsMobile from "../../../hooks/useIsMobile";
import { formatCurrencyBRL } from "../../../utils/brazilianCurrency";
import { formatQuantity } from "../utils";
import {
  pickExactSaleProduct,
  saleProductStockLabel,
} from "../saleProductSearch";

if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

if (typeof document.createRange !== "function") {
  document.createRange = () => ({
    setStart: () => {},
    setEnd: () => {},
    commonAncestorContainer: document.body,
    getBoundingClientRect: () => ({
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
    }),
    getClientRects: () => [],
  });
}

jest.mock("../../../services/inventoryApi", () => ({
  addInventorySaleItem: jest.fn(),
  updateInventorySaleItem: jest.fn(),
  deleteInventorySaleItem: jest.fn(),
  listInventoryProducts: jest.fn(() => Promise.resolve({ data: [] })),
}));

jest.mock("../../../hooks/useIsMobile", () => ({
  __esModule: true,
  default: jest.fn(() => false),
}));

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => ({
    canAuthorizeDiscount: true,
  }),
}));

jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("../../../errors/toastError", () => jest.fn());

const theme = createTheme();

function product(overrides = {}) {
  return {
    id: 10,
    name: "Capinha iPhone",
    sku: "CAP29",
    barcode: "789123",
    unit: "un",
    salePrice: 29.9,
    currentQuantity: 19,
    trackStock: true,
    active: true,
    costPrice: 999,
    ...overrides,
  };
}

function renderEditor(props = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <SaleItemsEditor
        sale={{
          id: 7,
          status: "draft",
          items: [],
          subtotalAmount: "0",
          discountAmount: "0",
          totalAmount: "0",
        }}
        readOnly={false}
        onSaleUpdated={jest.fn()}
        {...props}
      />
    </ThemeProvider>
  );
}

function searchInput() {
  return screen.getByTestId("sale-product-search");
}

async function typeSearch(value) {
  fireEvent.change(searchInput(), { target: { value } });
  await waitFor(() => {
    const last = listInventoryProducts.mock.calls[listInventoryProducts.mock.calls.length - 1];
    expect(last?.[0]?.search).toBe(value.trim());
  });
}

describe("busca de produto na venda", () => {
  beforeEach(() => {
    changeLanguage("pt");
    useIsMobile.mockReturnValue(false);
    jest.clearAllMocks();
    listInventoryProducts.mockResolvedValue({ data: [] });
    addInventorySaleItem.mockResolvedValue({});
  });

  it("não consulta o catálogo ao abrir e o drawer não carrega a lista inteira", () => {
    renderEditor();
    expect(listInventoryProducts).not.toHaveBeenCalled();
    const drawer = fs.readFileSync(path.join(__dirname, "../SaleDrawer.js"), "utf8");
    expect(drawer).not.toContain("listInventoryProducts");
    expect(screen.getByPlaceholderText(
      "Buscar produto por nome, SKU ou código de barras..."
    )).toBeTruthy();
  });

  it("digita com debounce e pede só 20 produtos ativos", () => {
    jest.useFakeTimers();
    try {
      renderEditor();
      fireEvent.change(searchInput(), { target: { value: "cap" } });
      expect(listInventoryProducts).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(299);
      });
      expect(listInventoryProducts).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(listInventoryProducts).toHaveBeenCalledTimes(1);
      expect(listInventoryProducts).toHaveBeenCalledWith(
        { active: true, search: "cap", limit: 20 },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("mostra nome, SKU, preço, estoque e unidade, e não mostra o custo", async () => {
    listInventoryProducts.mockResolvedValue({ data: [product()] });
    renderEditor();
    await typeSearch("cap");
    const optionText = screen.getByRole("option").textContent.replace(/\u00a0/g, " ");
    const price = formatCurrencyBRL(29.9).replace(/\u00a0/g, " ");
    expect(optionText).toContain("Capinha iPhone");
    expect(optionText).toContain("SKU: CAP29");
    expect(optionText).toContain(price);
    expect(optionText).toContain(`Estoque: ${formatQuantity(19)} un`);
    expect(optionText).not.toContain("999");
  });

  it("exibe resultado humano sem refiltrar caixa e acento no navegador", async () => {
    listInventoryProducts.mockResolvedValue({
      data: [product({ name: "PELÍCULA", sku: "PEL", barcode: "0099" })],
    });
    renderEditor();
    await typeSearch("pelicula");
    expect(screen.getByRole("option", { name: /PELÍCULA/ })).toBeTruthy();
    expect(addInventorySaleItem).not.toHaveBeenCalled();
  });

  it("omite SKU vazio, marca sem estoque e sem controle, e ainda permite adicionar", async () => {
    const out = product({
      id: 11,
      name: "Película",
      sku: "",
      barcode: "111",
      currentQuantity: 0,
      salePrice: 5,
    });
    const open = product({
      id: 12,
      name: "Serviço",
      sku: null,
      barcode: "222",
      trackStock: false,
      currentQuantity: 0,
      salePrice: 0,
      unit: "un",
    });
    listInventoryProducts.mockResolvedValue({ data: [out, open] });
    renderEditor();
    await typeSearch("pel");
    const optionText = screen.getAllByRole("option").map((option) => option.textContent).join("\n");
    expect(optionText).not.toMatch(/SKU:/);
    expect(optionText).toContain("Sem estoque");
    expect(optionText).toContain("Sem controle de estoque");
    fireEvent.click(screen.getByRole("option", { name: /Película/ }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar item/ }));
    await waitFor(() =>
      expect(addInventorySaleItem).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ productId: 11, quantity: 1 })
      )
    );
  });

  it("mostra loading, vazio e erro no campo, sem toast destrutivo", async () => {
    let resolveSearch;
    listInventoryProducts.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        })
    );
    renderEditor();
    fireEvent.change(searchInput(), { target: { value: "cap" } });
    await waitFor(() => expect(screen.getByRole("progressbar")).toBeTruthy());
    await act(async () => {
      resolveSearch({ data: [] });
    });
    expect(await screen.findByText("Nenhum produto encontrado.")).toBeTruthy();

    listInventoryProducts.mockRejectedValue(new Error("falha"));
    fireEvent.change(searchInput(), { target: { value: "capa" } });
    expect(await screen.findByText("Não foi possível buscar produtos. Tente de novo.")).toBeTruthy();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("ignora resposta atrasada", async () => {
    const pending = [];
    listInventoryProducts.mockImplementation(
      (params) =>
        new Promise((resolve) => {
          pending.push({ params, resolve });
        })
    );
    renderEditor();
    fireEvent.change(searchInput(), { target: { value: "cap" } });
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.change(searchInput(), { target: { value: "capin" } });
    await waitFor(() => expect(pending).toHaveLength(2));
    await act(async () => {
      pending[1].resolve({
        data: [product({ id: 2, name: "Capinha nova", sku: "N" })],
      });
    });
    expect(await screen.findByText("Capinha nova")).toBeTruthy();
    await act(async () => {
      pending[0].resolve({
        data: [product({ id: 1, name: "Capa antiga", sku: "A" })],
      });
    });
    expect(screen.queryByText("Capa antiga")).toBeNull();
    expect(screen.getByText("Capinha nova")).toBeTruthy();
  });

  it("não aplica uma busca antiga depois que o termo foi apagado", async () => {
    const resolvers = [];
    listInventoryProducts.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );
    renderEditor();
    fireEvent.change(searchInput(), { target: { value: "789123" } });
    fireEvent.keyDown(searchInput(), { key: "Enter" });
    await waitFor(() => expect(resolvers.length).toBe(1));
    fireEvent.change(searchInput(), { target: { value: "" } });
    await waitFor(() => expect(resolvers.length).toBe(2));
    expect(listInventoryProducts.mock.calls[1][0]).toEqual({
      active: true,
      limit: 20,
    });
    await act(async () => {
      resolvers[0]({
        data: [product({ barcode: "789123" })],
      });
    });
    expect(searchInput().value).toBe("");
    expect(screen.queryByText("Capinha iPhone")).toBeNull();
    expect(addInventorySaleItem).not.toHaveBeenCalled();
  });

  it("Enter busca na hora e seleciona um barcode exato, sem adicionar a linha", async () => {
    const cap = product({ barcode: "789123" });
    listInventoryProducts.mockResolvedValue({ data: [cap] });
    renderEditor();
    fireEvent.change(searchInput(), { target: { value: "789123" } });
    fireEvent.keyDown(searchInput(), { key: "Enter" });
    expect(listInventoryProducts).toHaveBeenCalledWith(
      { active: true, search: "789123", limit: 20 },
      expect.any(Object)
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    expect(listInventoryProducts).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(searchInput().value).toBe("Capinha iPhone"));
    expect(addInventorySaleItem).not.toHaveBeenCalled();
  });

  it("SKU exato único seleciona e o botão ainda é necessário", async () => {
    listInventoryProducts.mockResolvedValue({
      data: [product({ id: 3, name: "Controle", sku: "PS5", barcode: "000" })],
    });
    renderEditor();
    fireEvent.change(searchInput(), { target: { value: "PS5" } });
    fireEvent.keyDown(searchInput(), { key: "Enter" });
    await waitFor(() => expect(searchInput().value).toBe("Controle"));
    expect(addInventorySaleItem).not.toHaveBeenCalled();
  });

  it("match parcial não seleciona sozinho", async () => {
    listInventoryProducts.mockResolvedValue({
      data: [product({ id: 4, name: "Capinha azul", sku: "AZUL", barcode: "555" })],
    });
    renderEditor();
    fireEvent.change(searchInput(), { target: { value: "cap" } });
    fireEvent.keyDown(searchInput(), { key: "Enter" });
    await waitFor(() =>
      expect(listInventoryProducts).toHaveBeenCalledWith(
        { active: true, search: "cap", limit: 20 },
        expect.any(Object)
      )
    );
    expect(searchInput().value).toBe("cap");
    expect(addInventorySaleItem).not.toHaveBeenCalled();
  });

  it("barcode duplicado não escolhe um produto", async () => {
    listInventoryProducts.mockResolvedValue({
      data: [
        product({ id: 5, name: "A", sku: "A1", barcode: "999" }),
        product({ id: 6, name: "B", sku: "B1", barcode: "999" }),
      ],
    });
    renderEditor();
    fireEvent.change(searchInput(), { target: { value: "999" } });
    fireEvent.keyDown(searchInput(), { key: "Enter" });
    await waitFor(() => expect(screen.getByRole("option", { name: /^A/ })).toBeTruthy());
    expect(screen.getByRole("option", { name: /^B/ })).toBeTruthy();
    expect(searchInput().value).toBe("999");
    expect(addInventorySaleItem).not.toHaveBeenCalled();
  });

  it("limpa a busca depois de adicionar e permite o mesmo produto de novo", async () => {
    const cap = product();
    listInventoryProducts.mockResolvedValue({ data: [cap] });
    renderEditor();
    fireEvent.change(searchInput(), { target: { value: "789123" } });
    fireEvent.keyDown(searchInput(), { key: "Enter" });
    await waitFor(() => expect(searchInput().value).toBe("Capinha iPhone"));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar item/ }));
    await waitFor(() => expect(searchInput().value).toBe(""));
    expect(addInventorySaleItem).toHaveBeenCalledTimes(1);

    fireEvent.change(searchInput(), { target: { value: "789123" } });
    fireEvent.keyDown(searchInput(), { key: "Enter" });
    await waitFor(() => expect(searchInput().value).toBe("Capinha iPhone"));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar item/ }));
    await waitFor(() => expect(addInventorySaleItem).toHaveBeenCalledTimes(2));
    expect(addInventorySaleItem.mock.calls[1][1].productId).toBe(10);
  });

  it("não foca a busca em viewport estreita", () => {
    const original = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }));
    renderEditor();
    expect(document.activeElement).not.toBe(searchInput());
    window.matchMedia = original;
  });

  it("quantidade com unidade usa o formatador existente", () => {
    changeLanguage("pt");
    expect(
      saleProductStockLabel({
        trackStock: true,
        currentQuantity: 0.5,
        unit: "kg",
      })
    ).toBe(`Estoque: ${formatQuantity(0.5)} kg`);
    expect(pickExactSaleProduct([{ id: 1, barcode: "ABC" }], "abc")).toBeNull();
    expect(pickExactSaleProduct([{ id: 1, barcode: "ABC" }], " ABC ").id).toBe(1);
  });

  it("a seta com campo vazio pede só os primeiros 20", async () => {
    listInventoryProducts.mockResolvedValue({ data: [product()] });
    renderEditor();
    expect(listInventoryProducts).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Open"));
    await waitFor(() =>
      expect(listInventoryProducts).toHaveBeenCalledWith(
        { active: true, limit: 20 },
        expect.any(Object)
      )
    );
    expect(listInventoryProducts.mock.calls[0][0].search).toBeUndefined();
    expect(await screen.findByRole("option")).toBeTruthy();
  });

  it("fechar o campo cancela a busca sem toast", async () => {
    let resolveSearch;
    listInventoryProducts.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        })
    );
    renderEditor();
    fireEvent.click(screen.getByLabelText("Open"));
    await waitFor(() => expect(listInventoryProducts).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.queryByRole("progressbar")).toBeNull();
    await act(async () => {
      resolveSearch({ data: [product()] });
    });
    expect(screen.queryByRole("option")).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("identidade exata de barcode", () => {
  it("distingue caixa, acento e zeros; preserva espaços internos", () => {
    const exact = product({ barcode: "00ÁbC 12", sku: "OTHER" });
    ["00ábc 12", "00AbC 12", "ÁbC 12", "00ÁbC12"].forEach((term) => {
      expect(pickExactSaleProduct([exact], term)).toBeNull();
    });
    expect(pickExactSaleProduct([exact], " 00ÁbC 12 ")).toBe(exact);
  });
});
