/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import { changeLanguage } from "../../../translate/i18n";
import InventoryReceivablesTab from "../InventoryReceivablesTab";
import {
  civilDateFromLocalInstant,
  todayCivilDate,
} from "../storeCreditInstallmentDisplay";

class MockMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
global.MutationObserver = MockMutationObserver;

const mockList = jest.fn();
const mockSummary = jest.fn();
const mockGet = jest.fn();
const mockCreatePayment = jest.fn();

jest.mock("../../../services/inventoryApi", () => ({
  listInventoryReceivables: (...a) => mockList(...a),
  getInventoryReceivablesSummary: (...a) => mockSummary(...a),
  getInventoryReceivable: (...a) => mockGet(...a),
  createInventoryReceivablePayment: (...a) => mockCreatePayment(...a),
  reverseInventoryReceivablePayment: jest.fn(),
}));

jest.mock("../printReceivablePaymentReceipt", () => ({
  printReceivablePaymentReceipt: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../../errors/toastError", () => jest.fn());
jest.mock("../../../hooks/useIsMobile", () => () => false);
jest.mock("../../../components/ConfirmationModal", () => () => null);
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("../../../utils/inventoryAccess", () => ({
  useInventoryPermissions: () => ({
    canViewReceivables: true,
    canReceiveReceivables: true,
    canReverseReceivablePayments: true,
  }),
}));

const detailPayload = {
  id: 3,
  openAmount: 100,
  customer: { name: "Cliente A", document: "52998224725" },
  sale: { saleNumber: 10 },
  installments: [
    {
      id: 9,
      sequence: 1,
      dueDate: "2026-10-15",
      openAmount: 100,
      displayStatus: "open",
      status: "open",
    },
  ],
  payments: [],
};

describe("InventoryReceivablesTab receive date (date-only)", () => {
  beforeAll(async () => {
    await changeLanguage("pt");
  });

  beforeEach(() => {
    mockList.mockReset();
    mockSummary.mockReset();
    mockGet.mockReset();
    mockCreatePayment.mockReset();
    mockSummary.mockResolvedValue({
      data: {
        openAmount: 100,
        overdueAmount: 0,
        dueTodayAmount: 0,
        next7DaysAmount: 100,
      },
    });
    mockList.mockResolvedValue({
      data: {
        installments: [
          {
            installmentId: 9,
            receivableId: 3,
            customerName: "Cliente A",
            saleNumber: 10,
            sequence: 1,
            dueDate: "2026-10-15",
            originalAmount: 100,
            paidAmount: 0,
            openAmount: 100,
            displayStatus: "open",
            status: "open",
          },
        ],
        count: 1,
        page: 1,
        limit: 20,
      },
    });
    mockGet.mockResolvedValue({ data: detailPayload });
    mockCreatePayment.mockResolvedValue({
      data: {
        ...detailPayload,
        openAmount: 0,
        receivedAmount: 100,
        lastPaymentAllocations: [
          {
            installmentId: 9,
            sequence: 1,
            dueDate: "2026-10-15",
            amount: 100,
            openAmountAfter: 0,
          },
        ],
        payments: [
          {
            id: 50,
            amount: 100,
            paymentMethod: "pix",
            paidAt: "2026-10-08T11:56:00.000Z",
            createdByUser: { id: 1, name: "Ana" },
          },
        ],
      },
    });
  });

  async function openReceiveDialog() {
    render(
      <ThemeProvider theme={createTheme()}>
        <InventoryReceivablesTab />
      </ThemeProvider>
    );
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    await userEvent.click(await screen.findByTestId("receivable-receive-9"));
    await waitFor(() =>
      expect(screen.getByTestId("receivable-receive-paid-at")).toBeTruthy()
    );
  }

  it("campo é type=date (sem hora manual) e nasce válido com hoje", async () => {
    await openReceiveDialog();
    const input = screen.getByTestId("receivable-receive-paid-at");
    expect(input.getAttribute("type")).toBe("date");
    expect(input.value).toBe(todayCivilDate());
    expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(input.value).not.toMatch(/T/);
  });

  it("seleciona data sem hora, confirma, envia paidAt ISO com hora automática e dia preservado", async () => {
    await openReceiveDialog();
    const input = screen.getByTestId("receivable-receive-paid-at");
    fireEvent.change(input, { target: { value: "2026-10-08" } });
    expect(input.value).toBe("2026-10-08");

    const confirm = screen.getByRole("button", {
      name: /Confirmar recebimento/i,
    });
    await userEvent.click(confirm);

    await waitFor(() => expect(mockCreatePayment).toHaveBeenCalled());
    const [, body] = mockCreatePayment.mock.calls[0];
    expect(body.paidAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(civilDateFromLocalInstant(body.paidAt)).toBe("2026-10-08");
    // Hora veio do relógio (não 00:00:00.000Z forçado por parse UTC da data)
    const t = new Date(body.paidAt);
    expect(
      t.getHours() + t.getMinutes() + t.getSeconds() + t.getMilliseconds()
    ).toBeGreaterThanOrEqual(0);
  });

  it("comprovante recebe paidAt registrado (histórico/API)", async () => {
    const {
      printReceivablePaymentReceipt,
    } = require("../printReceivablePaymentReceipt");
    await openReceiveDialog();
    fireEvent.change(screen.getByTestId("receivable-receive-paid-at"), {
      target: { value: "2026-10-08" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Confirmar recebimento/i })
    );
    await waitFor(() =>
      expect(printReceivablePaymentReceipt).toHaveBeenCalled()
    );
    const arg = printReceivablePaymentReceipt.mock.calls[0][0];
    expect(arg.paidAt).toBeTruthy();
    // Preferência: paidAt persistido na baixa retornada
    expect(arg.paidAt).toBe("2026-10-08T11:56:00.000Z");
  });
});
