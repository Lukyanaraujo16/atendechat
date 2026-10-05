/**
 * @jest-environment jsdom
 */
import React, { useState } from "react";
import fs from "fs";
import path from "path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import { changeLanguage } from "../../../translate/i18n";
import SaleDrawer from "../SaleDrawer";
import {
  completeInventorySale,
  getInventorySale,
  searchInventoryCustomers,
  updateInventorySale,
  updateInventorySalePayment,
} from "../../../services/inventoryApi";
import api from "../../../services/api";

jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

jest.mock("../../../errors/toastError", () => jest.fn());

jest.mock("../SaleItemsEditor", () => (props) => (
  <div data-testid="sale-items-editor" data-readonly={String(props.readOnly)} />
));

jest.mock("../SalePaymentDialog", () => () => null);
jest.mock("../SaleReceiptDialog", () => () => null);

const mockPerms = {
  canCreateSale: true,
  canManagePayments: false,
  canCancelSale: true,
};

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => mockPerms,
}));

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock("../../../services/inventoryApi", () => ({
  getInventorySale: jest.fn(),
  updateInventorySale: jest.fn(),
  updateInventorySalePayment: jest.fn(),
  completeInventorySale: jest.fn(),
  cancelInventorySale: jest.fn(),
  deleteInventorySale: jest.fn(),
  searchInventoryCustomers: jest.fn(),
}));

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

const theme = createTheme();

jest.setTimeout(20000);

function draftSale(overrides = {}) {
  return {
    id: 12,
    status: "draft",
    saleNumber: -12,
    contactId: null,
    contact: null,
    sellerUserId: 3,
    seller: { id: 3, name: "Vendedor Souza" },
    notes: "",
    paymentMethod: null,
    paymentNotes: null,
    paymentStatus: "unpaid",
    paidAmount: 0,
    subtotalAmount: 10,
    discountAmount: 0,
    totalAmount: 10,
    items: [],
    ...overrides,
  };
}

function renderDrawer(sale = draftSale(), props = {}) {
  getInventorySale.mockResolvedValue({ data: sale });
  return render(
    <ThemeProvider theme={theme}>
      <SaleDrawer open saleId={sale.id} onClose={jest.fn()} {...props} />
    </ThemeProvider>
  );
}

async function ready() {
  await screen.findByTestId("sale-items-editor");
}

describe("SaleDrawer cliente e persistência", () => {
  beforeEach(() => {
    changeLanguage("pt");
    mockPerms.canCreateSale = true;
    mockPerms.canManagePayments = false;
    mockPerms.canCancelSale = true;
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: [{ id: 3, name: "Vendedor Souza" }] });
    searchInventoryCustomers.mockResolvedValue({ data: { customers: [] } });
    updateInventorySale.mockImplementation(async (_id, body) => ({
      data: {
        ...draftSale(),
        ...body,
        contact: body.contactId
          ? { id: body.contactId, name: "João da Silva", number: "27999999999" }
          : null,
      },
    }));
    updateInventorySalePayment.mockResolvedValue({
      data: draftSale({ paymentMethod: "pix", paymentNotes: "pago" }),
    });
    completeInventorySale.mockResolvedValue({
      data: draftSale({ status: "completed", saleNumber: 40 }),
    });
  });

  it("mostra um único cliente e a hierarquia do rascunho", async () => {
    renderDrawer();
    await ready();

    expect(screen.getAllByTestId("sale-customer-search")).toHaveLength(1);
    expect(screen.queryByPlaceholderText("Pesquisar cliente…")).toBeNull();
    expect(screen.getByText("Dados da venda")).toBeTruthy();
    expect(screen.getByText("Pagamento")).toBeTruthy();
    expect(screen.getByText("Resumo")).toBeTruthy();
    expect(screen.getByText(/Subtotal/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar dados" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Guardar pagamento" })).toBeNull();

    const src = fs.readFileSync(path.join(__dirname, "../SaleDrawer.js"), "utf8");
    expect(src).toContain("maxWidth: 720");
    expect(src).toContain('maxWidth: "100vw"');
    expect(src).not.toContain('"/contacts"');
    expect(src).not.toContain("listInventoryProducts");
    const dataAt = src.indexOf("sections.saleData");
    const itemsAt = src.indexOf("<SaleItemsEditor");
    const paymentAt = src.indexOf("sales.payment.sectionTitle");
    const summaryAt = src.indexOf("sections.summary");
    expect(dataAt).toBeLessThan(itemsAt);
    expect(itemsAt).toBeLessThan(paymentAt);
    expect(paymentAt).toBeLessThan(summaryAt);
  });

  it("busca nome e telefone com debounce, loading, vazio e limpar", async () => {
    let resolveSearch;
    searchInventoryCustomers.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        })
    );
    renderDrawer();
    await ready();
    const input = screen.getByTestId("sale-customer-search");

    jest.useFakeTimers();
    try {
      fireEvent.change(input, { target: { value: "Jo" } });
      act(() => {
        jest.advanceTimersByTime(299);
      });
      expect(searchInventoryCustomers).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(1);
      });
    } finally {
      jest.useRealTimers();
    }

    await waitFor(() => expect(searchInventoryCustomers).toHaveBeenCalledTimes(1));
    expect(searchInventoryCustomers.mock.calls[0][0]).toEqual({
      search: "Jo",
      limit: 20,
    });
    expect(screen.getByRole("progressbar")).toBeTruthy();

    resolveSearch({
      data: { customers: [{ id: 8, name: "João da Silva", number: "27999999999" }] },
    });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(await screen.findByText("27999999999")).toBeTruthy();
    fireEvent.click(screen.getByText("João da Silva"));

    await waitFor(() => {
      expect(input.value).toBe("João da Silva");
    });
    const clear = document.querySelector('[aria-label="Clear"]');
    expect(clear).toBeTruthy();
    fireEvent.click(clear);
    await waitFor(() => expect(input.value).toBe(""));

    searchInventoryCustomers.mockResolvedValue({ data: { customers: [] } });
    fireEvent.change(input, { target: { value: "9999" } });
    await waitFor(() =>
      expect(searchInventoryCustomers).toHaveBeenLastCalledWith(
        { search: "9999", limit: 20 },
        expect.any(Object)
      )
    );
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(await screen.findByText("Nenhum cliente encontrado")).toBeTruthy();
  });

  it("ignora resposta atrasada e resposta depois de fechar", async () => {
    const pending = [];
    searchInventoryCustomers.mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.push(resolve);
        })
    );
    const view = renderDrawer();
    await ready();
    const input = screen.getByTestId("sale-customer-search");
    fireEvent.change(input, { target: { value: "ana" } });
    await waitFor(() => expect(pending.length).toBe(1));
    fireEvent.change(input, { target: { value: "bia" } });
    await waitFor(() => expect(pending.length).toBe(2));

    pending[1]({
      data: { customers: [{ id: 2, name: "Bia", number: "111" }] },
    });
    expect(await screen.findByText("Bia")).toBeTruthy();
    pending[0]({
      data: { customers: [{ id: 1, name: "Ana Antiga", number: "000" }] },
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText("Ana Antiga")).toBeNull();

    fireEvent.click(screen.getByLabelText("close"));
    pending.push = () => {};
    view.unmount();
    pending[0]({
      data: { customers: [{ id: 9, name: "Tarde Demais", number: "9" }] },
    });
    expect(screen.queryByText("Tarde Demais")).toBeNull();
  });

  it("reabre com o cliente salvo e guarda só os dados gerais", async () => {
    renderDrawer(
      draftSale({
        contactId: 8,
        contact: { id: 8, name: "João da Silva", number: "27999999999" },
        notes: "Balcão",
        sellerUserId: 3,
      })
    );
    await ready();
    const input = screen.getByTestId("sale-customer-search");
    expect(input.value).toBe("João da Silva");
    expect(searchInventoryCustomers).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("sale-notes"), {
      target: { value: "Entrega" },
    });
    expect(screen.getByText("Alterações não salvas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Guardar dados" }));

    await waitFor(() => expect(updateInventorySale).toHaveBeenCalledTimes(1));
    expect(updateInventorySale).toHaveBeenCalledWith(12, {
      notes: "Entrega",
      sellerUserId: 3,
      contactId: 8,
    });
    expect(updateInventorySalePayment).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it("guarda pagamento só com permissão e um erro financeiro não apaga a observação", async () => {
    mockPerms.canManagePayments = true;
    updateInventorySalePayment.mockRejectedValue(new Error("payment-down"));
    renderDrawer(draftSale({ notes: "Original" }));
    await ready();

    fireEvent.change(screen.getByTestId("sale-notes"), {
      target: { value: "Ainda aqui" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar pagamento" }));
    await waitFor(() => expect(updateInventorySalePayment).toHaveBeenCalledTimes(1));
    expect(updateInventorySale).not.toHaveBeenCalled();
    expect(updateInventorySalePayment.mock.calls[0][1]).toEqual({
      paymentMethod: null,
      paymentNotes: null,
      paymentStatus: "unpaid",
      paidAmount: 0,
    });
    expect(screen.getByTestId("sale-notes").value).toBe("Ainda aqui");

    fireEvent.click(screen.getByRole("button", { name: "Guardar dados" }));
    await waitFor(() => expect(updateInventorySale).toHaveBeenCalledTimes(1));
    expect(updateInventorySale.mock.calls[0][1].notes).toBe("Ainda aqui");
    expect(updateInventorySale.mock.calls[0][1]).not.toHaveProperty("paymentMethod");
    expect(updateInventorySale.mock.calls[0][1]).not.toHaveProperty("paymentNotes");
  });

  it("conclui com os dados visíveis, vendedor obrigatório e cliente opcional", async () => {
    renderDrawer(draftSale({ sellerUserId: null, contactId: null }));
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Concluir venda" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Ok" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(completeInventorySale).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    toast.error.mockClear();
    fireEvent.change(screen.getByTestId("sale-notes"), {
      target: { value: "Levar" },
    });
    fireEvent.mouseDown(screen.getByLabelText("Vendedor"));
    fireEvent.click(await screen.findByRole("option", { name: "Vendedor Souza" }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Concluir venda" }));
    const again = await screen.findByRole("dialog");
    fireEvent.click(within(again).getByRole("button", { name: "Ok" }));

    await waitFor(() => expect(completeInventorySale).toHaveBeenCalled());
    expect(updateInventorySale).toHaveBeenCalledWith(
      12,
      expect.objectContaining({
        notes: "Levar",
        sellerUserId: 3,
        contactId: null,
      })
    );
    expect(updateInventorySale.mock.calls[0][1]).not.toHaveProperty("paymentMethod");
    expect(updateInventorySalePayment).not.toHaveBeenCalled();
  });

  it("mantém concluída, cancelada e um único cliente no mobile", async () => {
    const original = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    const completed = renderDrawer(
      draftSale({
        status: "completed",
        saleNumber: 40,
        contactId: 8,
        contact: { id: 8, name: "João da Silva", number: "27999999999" },
        paymentStatus: "paid",
        commissionAmount: 2,
        commissionRate: 5,
      })
    );
    await ready();
    expect(screen.getAllByTestId("sale-customer-search")).toHaveLength(1);
    expect(screen.getByTestId("sale-customer-search").value).toBe("João da Silva");
    expect(screen.getByTestId("sale-customer-search").disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Guardar dados" })).toBeNull();
    expect(screen.getByRole("button", { name: "Recibo" })).toBeTruthy();
    expect(screen.getByText(/Comissão/)).toBeTruthy();
    completed.unmount();

    renderDrawer(
      draftSale({
        status: "cancelled",
        cancelReason: "Desistiu",
        contact: null,
        contactId: null,
      })
    );
    await ready();
    expect(screen.getByText(/Desistiu/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recibo" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Concluir venda" })).toBeNull();
    expect(screen.getAllByTestId("sale-customer-search")).toHaveLength(1);

    window.matchMedia = original;
  });

  it("fecha sem gravar e não chama a API de clientes ao abrir", async () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <ThemeProvider theme={theme}>
          <button type="button" onClick={() => setOpen(false)}>
            fechar-drawer
          </button>
          <SaleDrawer
            open={open}
            saleId={12}
            onClose={() => setOpen(false)}
          />
        </ThemeProvider>
      );
    }
    getInventorySale.mockResolvedValue({ data: draftSale({ notes: "Salva" }) });
    render(<Harness />);
    await ready();
    fireEvent.change(screen.getByTestId("sale-notes"), {
      target: { value: "Não salva" },
    });
    fireEvent.click(screen.getByLabelText("close"));
    expect(updateInventorySale).not.toHaveBeenCalled();
    expect(searchInventoryCustomers).not.toHaveBeenCalled();
  });
});
