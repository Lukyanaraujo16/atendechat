import AppError from "../../errors/AppError";
import InventoryReceivable from "../../models/InventoryReceivable";
import InventoryReceivableInstallment from "../../models/InventoryReceivableInstallment";
import InventoryReceivablePayment from "../../models/InventoryReceivablePayment";
import InventoryCustomer from "../../models/InventoryCustomer";
import InventorySale from "../../models/InventorySale";
import User from "../../models/User";
import {
  deriveInstallmentDisplayStatus,
  todayCivilDate
} from "./inventoryReceivableHelpers";
import { roundMoney, toMoney } from "./inventorySaleHelpers";

export default async function GetInventoryReceivableService(input: {
  companyId: number;
  receivableId: number;
}) {
  const receivable = await InventoryReceivable.findOne({
    where: { id: input.receivableId, companyId: input.companyId },
    include: [
      {
        model: InventoryCustomer,
        attributes: ["id", "name", "document", "phone", "creditLimit"]
      },
      {
        model: InventorySale,
        attributes: ["id", "saleNumber", "totalAmount", "completedAt"]
      },
      {
        model: InventoryReceivableInstallment,
        separate: true,
        order: [["sequence", "ASC"]]
      },
      {
        model: InventoryReceivablePayment,
        separate: true,
        order: [["paidAt", "ASC"], ["id", "ASC"]],
        include: [
          {
            model: User,
            as: "createdByUser",
            attributes: ["id", "name"],
            required: false
          },
          {
            model: User,
            as: "reversedByUser",
            attributes: ["id", "name"],
            required: false
          }
        ]
      }
    ]
  });

  if (!receivable) {
    throw new AppError("ERR_INVENTORY_RECEIVABLE_NOT_FOUND", 404);
  }

  const today = todayCivilDate();
  return {
    id: receivable.id,
    companyId: receivable.companyId,
    customerId: receivable.customerId,
    customer: receivable.customer
      ? {
          id: receivable.customer.id,
          name: receivable.customer.name,
          document: receivable.customer.document,
          phone: receivable.customer.phone
        }
      : null,
    saleId: receivable.saleId,
    sale: receivable.sale
      ? {
          id: receivable.sale.id,
          saleNumber: receivable.sale.saleNumber,
          totalAmount: roundMoney(toMoney(receivable.sale.totalAmount)),
          completedAt: receivable.sale.completedAt
        }
      : null,
    originType: receivable.originType,
    originalAmount: roundMoney(toMoney(receivable.originalAmount)),
    openAmount: roundMoney(toMoney(receivable.openAmount)),
    status: receivable.status,
    scheduleFrequency: receivable.scheduleFrequency,
    installmentCount: receivable.installmentCount,
    firstDueDate: receivable.firstDueDate,
    createdByUserId: receivable.createdByUserId,
    createdAt: receivable.createdAt,
    updatedAt: receivable.updatedAt,
    installments: (receivable.installments || []).map(inst => ({
      id: inst.id,
      sequence: inst.sequence,
      dueDate: String(inst.dueDate),
      originalAmount: roundMoney(toMoney(inst.originalAmount)),
      paidAmount: roundMoney(toMoney(inst.paidAmount)),
      openAmount: roundMoney(toMoney(inst.openAmount)),
      status: inst.status,
      displayStatus: deriveInstallmentDisplayStatus(
        inst.status,
        String(inst.dueDate),
        today
      )
    })),
    payments: (receivable.payments || []).map(p => ({
      id: p.id,
      installmentId: p.installmentId,
      amount: roundMoney(toMoney(p.amount)),
      paymentMethod: p.paymentMethod,
      paidAt: p.paidAt,
      notes: p.notes,
      createdByUserId: p.createdByUserId,
      createdByUser: p.createdByUser
        ? { id: p.createdByUser.id, name: p.createdByUser.name }
        : null,
      reversedAt: p.reversedAt,
      reversedByUserId: p.reversedByUserId,
      reverseOfPaymentId: p.reverseOfPaymentId,
      reverseReason: p.reverseReason
    }))
  };
}
