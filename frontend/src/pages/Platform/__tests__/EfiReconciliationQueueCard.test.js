import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import EfiReconciliationQueueCard from "../EfiReconciliationQueueCard";

if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

jest.setTimeout(20000);

jest.mock("../../../errors/toastError", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

test("lista itens com rótulo pt-BR e exige observação para resolver", async () => {
  mockGet.mockResolvedValue({
    data: {
      items: [
        {
          id: 7,
          companyId: 3,
          invoiceId: 11,
          kind: "gateway_pix_amount_mismatch",
          status: "open",
          message: "Valor pago 10,00 difere de 12,00",
          createdAt: "2026-10-20T10:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
      hasMore: false,
    },
  });
  mockPost.mockResolvedValue({ data: {} });

  render(<EfiReconciliationQueueCard />);

  expect(await screen.findByText("Valor pago 10,00 difere de 12,00")).toBeTruthy();
  expect(mockGet).toHaveBeenCalledWith("/saas/finance/reconciliation", {
    params: { status: "open", page: 1, limit: 50 },
  });

  fireEvent.click(screen.getByRole("button", { name: "Resolver" }));
  // dialog aberto deixa o restante aria-hidden: só sobram o campo e o botão do diálogo
  const input = await screen.findByRole("textbox");
  const submit = screen.getByRole("button", { name: "Resolver" });

  fireEvent.change(input, { target: { value: "abc" } });
  expect(submit.disabled).toBe(true);

  fireEvent.change(input, { target: { value: "  conferido no extrato  " } });
  expect(submit.disabled).toBe(false);
  fireEvent.click(submit);

  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith("/saas/finance/reconciliation/7/resolve", {
      note: "conferido no extrato",
    })
  );
});
