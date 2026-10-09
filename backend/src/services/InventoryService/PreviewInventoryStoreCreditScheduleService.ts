import {
  generateStoreCreditSchedule,
  sumScheduleAmounts,
  StoreCreditInstallmentPreview
} from "./inventoryStoreCreditSchedule";
import { roundMoney } from "./inventorySaleHelpers";

export default function PreviewInventoryStoreCreditScheduleService(input: {
  financedAmount: unknown;
  frequency: unknown;
  installmentCount: unknown;
  firstDueDate: unknown;
}): {
  financedAmount: number;
  frequency: string;
  installmentCount: number;
  firstDueDate: string;
  installments: StoreCreditInstallmentPreview[];
  total: number;
} {
  const financedAmount = roundMoney(Number(input.financedAmount));
  const installmentCount = Number(input.installmentCount);
  const installments = generateStoreCreditSchedule({
    financedAmount,
    frequency: input.frequency,
    installmentCount,
    firstDueDate: input.firstDueDate
  });
  return {
    financedAmount,
    frequency: String(input.frequency),
    installmentCount: installments.length,
    firstDueDate: installments[0]?.dueDate ?? String(input.firstDueDate),
    installments,
    total: sumScheduleAmounts(installments)
  };
}
