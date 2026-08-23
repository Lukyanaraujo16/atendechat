/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { changeLanguage } from "../../../translate/i18n";
import SaleReceiptDialog from "../SaleReceiptDialog";
import useIsMobile from "../../../hooks/useIsMobile";

jest.mock("../../../hooks/useIsMobile", () => ({
  __esModule: true,
  default: jest.fn(() => false),
}));

const theme = createTheme();

function saleWithItems(items) {
  return {
    id: 7,
    status: "completed",
    saleNumber: 12,
    paymentStatus: "paid",
    paymentMethod: "pix",
    totalAmount: "200",
    subtotalAmount: "200",
    discountAmount: "0",
    paidAmount: "200",
    completedAt: "2026-08-22T12:00:00.000Z",
    contact: { name: "Cliente" },
    seller: { name: "Vendedor" },
    items,
  };
}

function renderReceipt(sale, { mobile = false } = {}) {
  useIsMobile.mockReturnValue(mobile);
  return render(
    <ThemeProvider theme={theme}>
      <SaleReceiptDialog open onClose={() => {}} sale={sale} />
    </ThemeProvider>
  );
}

describe("SaleReceiptDialog identifiers", () => {
  beforeEach(() => {
    changeLanguage("pt");
    useIsMobile.mockReturnValue(false);
  });

  it("19. recibo mostra identifiers abaixo do produto correspondente", () => {
    const { getByTestId, queryByTestId } = renderReceipt(
      saleWithItems([
        {
          id: 21,
          productName: "Roteador XYZ",
          quantity: 2,
          unit: "un",
          unitPrice: "100",
          discountAmount: "0",
          totalAmount: "200",
          identifiers: [
            { position: 1, identifier: "SN-A123" },
            { position: 2, identifier: "SN-A124" },
          ],
        },
        {
          id: 22,
          productName: "Cabo HDMI",
          quantity: 1,
          unitPrice: "20",
          discountAmount: "0",
          totalAmount: "20",
          identifiers: [{ position: 1, identifier: "AA:BB:CC:DD:EE:FF" }],
        },
      ])
    );
    const first = getByTestId("sale-receipt-item-identifiers-21");
    expect(first.textContent).toContain("Identificações");
    expect(first.textContent).toContain("SN-A123");
    expect(first.textContent).toContain("SN-A124");
    expect(first.textContent).not.toContain("AA:BB:CC:DD:EE:FF");
    expect(getByTestId("sale-receipt-item-identifiers-22").textContent).toContain(
      "AA:BB:CC:DD:EE:FF"
    );
    expect(queryByTestId("sale-receipt-item-identifiers-99")).toBeNull();
  });

  it("20. recibo sem identifiers preserva o layout antigo", () => {
    const { getByText, queryByTestId, container } = renderReceipt(
      saleWithItems([
        {
          id: 21,
          productName: "Roteador XYZ",
          quantity: 2,
          unit: "un",
          unitPrice: "100",
          discountAmount: "0",
          totalAmount: "200",
          identifiers: [],
        },
      ])
    );
    expect(getByText("Roteador XYZ")).toBeTruthy();
    expect(queryByTestId("sale-receipt-item-identifiers-21")).toBeNull();
    expect(container.textContent).not.toContain("Identificações");
  });

  it("serial/MAC longo quebra no recibo", () => {
    const longMac = "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77";
    const { getByTestId } = renderReceipt(
      saleWithItems([
        {
          id: 21,
          productName: "Roteador XYZ",
          quantity: 1,
          unitPrice: "100",
          discountAmount: "0",
          totalAmount: "100",
          identifiers: [{ position: 1, identifier: longMac }],
        },
      ])
    );
    const line = getByTestId("sale-receipt-item-identifiers-21");
    expect(line.textContent).toContain(longMac);
    const wrapEl = line.querySelector("span:last-child");
    expect(wrapEl).toBeTruthy();
  });

  it("21. recibo mobile também mostra identifiers no card do produto", () => {
    const { getByTestId, getByText } = renderReceipt(
      saleWithItems([
        {
          id: 21,
          productName: "Roteador XYZ",
          quantity: 2,
          unit: "un",
          unitPrice: "100",
          discountAmount: "0",
          totalAmount: "200",
          identifiers: [{ position: 1, identifier: "SN-A123" }],
        },
      ]),
      { mobile: true }
    );
    expect(getByText("Roteador XYZ")).toBeTruthy();
    expect(getByTestId("sale-receipt-item-identifiers-21").textContent).toContain(
      "SN-A123"
    );
  });
});
