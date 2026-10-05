import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "react-toastify";
import ProductFormDialog from "../ProductFormDialog";
import { i18n } from "../../../translate/i18n";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
}
global.MutationObserver = MockMutationObserver;
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockGet = jest.fn();
jest.mock("../../../services/inventoryApi", () => ({
  createInventoryProduct: (...args) => mockCreate(...args),
  updateInventoryProduct: (...args) => mockUpdate(...args),
  getInventoryProduct: (...args) => mockGet(...args),
}));
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const errorCode = "ERR_INVENTORY_PRODUCT_BARCODE_DUPLICATE";

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockReset().mockResolvedValue({ data: { id: 1 } });
  mockUpdate.mockReset().mockResolvedValue({ data: { id: 1 } });
  mockGet.mockResolvedValue({ data: { id: 1, name: "Produto", salePrice: 10, unit: "un", barcode: "OLD" } });
});

function mount(productId) {
  const onClose = jest.fn();
  const onSaved = jest.fn();
  render(<ProductFormDialog open productId={productId} onClose={onClose} onSaved={onSaved} categories={[]} />);
  return { onClose, onSaved };
}
function fill() {
  fireEvent.change(screen.getByLabelText("Nome *"), { target: { value: "Produto" } });
  fireEvent.change(screen.getByLabelText("Preço de venda *"), { target: { value: "10" } });
}
function submit() { fireEvent.submit(document.querySelector("form")); }

it("cadastro sem barcode envia null e conclui normalmente", async () => {
  const callbacks = mount();
  fill();
  expect(screen.getByText("EAN, UPC ou código interno.")).toBeTruthy();
  submit();
  await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledTimes(1));
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ barcode: null }));
  expect(callbacks.onClose).toHaveBeenCalledTimes(1);
});

it.each([undefined, 1])("duplicado mantém modal e dados na criação/edição (%p), permite corrigir e salvar", async productId => {
  const api = productId ? mockUpdate : mockCreate;
  api.mockRejectedValueOnce({ response: { data: { error: errorCode } } });
  const callbacks = mount(productId);
  if (productId) await waitFor(() => expect(screen.getByLabelText("Código de barras").value).toBe("OLD"));
  fill();
  fireEvent.change(screen.getByLabelText("Código de barras"), { target: { value: " 001ÁbC  " } });
  submit();
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
    "Este código de barras já está sendo usado por outro produto.", expect.any(Object)
  ));
  expect(api.mock.calls[0][productId ? 1 : 0].barcode).toBe("001ÁbC");
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByLabelText("Código de barras").value).toBe(" 001ÁbC  ");
  expect(screen.getByLabelText("Nome *").value).toBe("Produto");
  expect(callbacks.onClose).not.toHaveBeenCalled();
  expect(callbacks.onSaved).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Código de barras"), { target: { value: "NEW" } });
  submit();
  await waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledTimes(1));
  expect(callbacks.onClose).toHaveBeenCalledTimes(1);
});

it.each(["pt", "en", "es"])("erro e helper possuem tradução em %s", language => {
  expect(i18n.t(`backendErrors.${errorCode}`, { lng: language })).not.toContain(errorCode);
  expect(i18n.t("inventorySales.products.fields.barcodeHelp", { lng: language })).not.toContain("inventorySales.");
});
