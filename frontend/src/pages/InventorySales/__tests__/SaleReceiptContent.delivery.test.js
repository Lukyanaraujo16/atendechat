/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import SaleReceiptContent from "../SaleReceiptContent";

jest.mock("../../../hooks/useIsMobile", () => () => false);

function renderReceipt(sale, format = "a4") {
  return render(
    <ThemeProvider theme={createTheme()}>
      <SaleReceiptContent sale={sale} layout="print" format={format} />
    </ThemeProvider>
  );
}

describe("SaleReceiptContent delivery/freight", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  it("venda antiga sem delivery permanece sem bloco de entrega/frete", () => {
    renderReceipt({
      id: 1,
      status: "completed",
      saleNumber: 10,
      subtotalAmount: 100,
      discountAmount: 0,
      totalAmount: 100,
      freightAmount: 0,
      paidAmount: 100,
      items: [{ id: 1, productName: "Item", quantity: 1, unitPrice: 100, discountAmount: 0, totalAmount: 100 }],
    });
    expect(screen.queryByTestId("receipt-delivery-method")).toBeNull();
    expect(screen.queryByTestId("receipt-freight-line")).toBeNull();
    expect(screen.getAllByText(/Total/i).length).toBeGreaterThan(0);
  });

  it("pickup mostra modalidade e não linha R$ 0; delivery mostra frete e snapshot", () => {
    const { rerender } = renderReceipt({
      id: 2,
      status: "completed",
      saleNumber: 11,
      subtotalAmount: 100,
      discountAmount: 0,
      totalAmount: 100,
      freightAmount: 0,
      deliveryMethodName: "Retirada na loja",
      deliveryKind: "pickup",
      paidAmount: 100,
      items: [{ id: 1, productName: "Item", quantity: 1, unitPrice: 100, discountAmount: 0, totalAmount: 100 }],
    });
    expect(screen.getByTestId("receipt-delivery-method").textContent).toMatch(
      /Retirada na loja/
    );
    expect(screen.queryByTestId("receipt-freight-line")).toBeNull();

    rerender(
      <ThemeProvider theme={createTheme()}>
        <SaleReceiptContent
          sale={{
            id: 3,
            status: "completed",
            saleNumber: 12,
            subtotalAmount: 100,
            discountAmount: 0,
            totalAmount: 120,
            freightAmount: 20,
            deliveryMethodName: "Motoboy antigo",
            deliveryKind: "courier",
            paidAmount: 120,
            delivery: {
              recipientName: "Ana",
              street: "Rua Snap",
              number: "1",
              district: "Centro",
              city: "Santos",
              state: "SP",
            },
            contact: {
              street: "Rua Atual Contato",
              addressNumber: "99",
            },
            items: [
              {
                id: 1,
                productName: "Item",
                quantity: 1,
                unitPrice: 100,
                discountAmount: 0,
                totalAmount: 100,
              },
            ],
          }}
          layout="print"
          format="a4"
        />
      </ThemeProvider>
    );
    expect(screen.getByTestId("receipt-delivery-method").textContent).toMatch(
      /Motoboy antigo/
    );
    expect(screen.getByTestId("receipt-freight-line").textContent).toMatch(/20/);
    expect(screen.getByTestId("receipt-delivery-address").textContent).toMatch(
      /Rua Snap/
    );
    expect(screen.queryByText(/Rua Atual Contato/)).toBeNull();
  });

  it("térmica 80/58 também mostra modalidade e frete > 0", () => {
    renderReceipt(
      {
        id: 4,
        status: "completed",
        saleNumber: 13,
        subtotalAmount: 50,
        discountAmount: 0,
        totalAmount: 65,
        freightAmount: 15,
        deliveryMethodName: "Motoboy",
        paidAmount: 65,
        items: [
          {
            id: 1,
            productName: "X",
            quantity: 1,
            unitPrice: 50,
            discountAmount: 0,
            totalAmount: 50,
          },
        ],
      },
      "thermal80"
    );
    expect(screen.getByTestId("receipt-delivery-method")).toBeTruthy();
    expect(screen.getByTestId("receipt-freight-line")).toBeTruthy();
  });
});
