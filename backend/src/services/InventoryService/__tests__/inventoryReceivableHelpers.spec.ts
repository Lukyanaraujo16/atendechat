import {
  allocateAmountAcrossInstallments,
  deriveInstallmentDisplayStatus,
  sortInstallmentsForAllocation
} from "../inventoryReceivableHelpers";

describe("inventoryReceivableHelpers", () => {
  const today = "2026-10-08";

  it("parcela aberta vira vencida por data sem corromper status", () => {
    expect(deriveInstallmentDisplayStatus("open", "2026-10-01", today)).toBe(
      "overdue"
    );
    expect(deriveInstallmentDisplayStatus("open", "2026-10-08", today)).toBe(
      "open"
    );
    expect(deriveInstallmentDisplayStatus("paid", "2026-10-01", today)).toBe(
      "paid"
    );
  });

  it("alocação: vencidos antigos → próximos → demais", () => {
    const ordered = sortInstallmentsForAllocation(
      [
        { id: 1, dueDate: "2026-10-20", status: "open", openAmount: 100 },
        { id: 2, dueDate: "2026-09-01", status: "open", openAmount: 50 },
        { id: 3, dueDate: "2026-10-09", status: "open", openAmount: 80 },
        { id: 4, dueDate: "2026-08-01", status: "open", openAmount: 40 }
      ],
      today
    );
    expect(ordered.map(r => r.id)).toEqual([4, 2, 3, 1]);
  });

  it("baixa parcial/total e bloqueio acima do saldo", () => {
    const alloc = allocateAmountAcrossInstallments(
      [
        { id: 1, dueDate: "2026-09-01", status: "open", openAmount: 100 },
        { id: 2, dueDate: "2026-10-20", status: "open", openAmount: 100 }
      ],
      150,
      today
    );
    expect(alloc).toEqual([
      { installmentId: 1, amount: 100 },
      { installmentId: 2, amount: 50 }
    ]);

    try {
      allocateAmountAcrossInstallments(
        [{ id: 1, dueDate: "2026-09-01", status: "open", openAmount: 100 }],
        101,
        today
      );
      fail("expected throw");
    } catch (err: any) {
      expect(err.message).toBe("ERR_INVENTORY_RECEIVABLE_OVERPAYMENT");
    }
  });
});
