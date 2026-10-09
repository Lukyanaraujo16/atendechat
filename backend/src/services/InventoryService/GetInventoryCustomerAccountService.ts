import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import InventoryCustomer from "../../models/InventoryCustomer";
import Contact from "../../models/Contact";
import InventorySale from "../../models/InventorySale";
import InventoryReceivable from "../../models/InventoryReceivable";
import InventoryReceivableInstallment from "../../models/InventoryReceivableInstallment";
import InventoryReceivablePayment from "../../models/InventoryReceivablePayment";
import InventoryStoreCreditOverride from "../../models/InventoryStoreCreditOverride";
import User from "../../models/User";
import { customerToJSON } from "./inventoryCustomerHelpers";
import {
  getCustomerCreditSnapshot,
  computeCreditAvailable
} from "./inventoryCustomerCredit";
import {
  mapInstallmentRow,
  todayCivilDate
} from "./inventoryReceivableHelpers";
import { roundMoney, toMoney } from "./inventorySaleHelpers";

/**
 * Conta do Cliente — visão consolidada (cadastro + crédito + carteira + histórico).
 */
export default async function GetInventoryCustomerAccountService(input: {
  companyId: number;
  customerId: number;
}): Promise<Record<string, unknown>> {
  const customer = await InventoryCustomer.findOne({
    where: { id: input.customerId, companyId: input.companyId },
    include: [
      {
        model: Contact,
        attributes: ["id", "name", "number"],
        required: false
      }
    ]
  });
  if (!customer) {
    throw new AppError("ERR_INVENTORY_CUSTOMER_NOT_FOUND", 404);
  }

  const credit = await getCustomerCreditSnapshot(
    input.companyId,
    customer.id
  );
  const upcomingOpenAmount = roundMoney(
    Math.max(credit.openAmount - credit.overdueOpenAmount, 0)
  );

  const today = todayCivilDate();
  const openInstallments = await InventoryReceivableInstallment.findAll({
    where: {
      companyId: input.companyId,
      status: { [Op.in]: ["open", "partial"] }
    },
    include: [
      {
        model: InventoryReceivable,
        required: true,
        where: {
          companyId: input.companyId,
          customerId: customer.id,
          status: { [Op.in]: ["open", "partial"] }
        },
        include: [
          {
            model: InventorySale,
            attributes: ["id", "saleNumber"],
            required: false
          },
          {
            model: InventoryCustomer,
            attributes: ["id", "name", "document", "phone"],
            required: false
          }
        ]
      }
    ],
    order: [
      ["dueDate", "ASC"],
      ["sequence", "ASC"]
    ],
    limit: 50
  });

  const installments = openInstallments.map(row => {
    const recv = row.receivable as InventoryReceivable | undefined;
    return mapInstallmentRow(
      row,
      {
        customerId: customer.id,
        customerName: customer.name,
        customerDocument: customer.document,
        saleId: recv?.saleId ?? null,
        saleNumber: recv?.sale?.saleNumber ?? null,
        originType: recv?.originType ?? "store_credit"
      },
      today
    );
  });

  const sales = await InventorySale.findAll({
    where: {
      companyId: input.companyId,
      customerId: customer.id
    },
    attributes: [
      "id",
      "saleNumber",
      "status",
      "totalAmount",
      "paidAmount",
      "paymentStatus",
      "completedAt",
      "createdAt"
    ],
    order: [
      ["completedAt", "DESC"],
      ["id", "DESC"]
    ],
    limit: 30
  });

  const receivables = await InventoryReceivable.findAll({
    where: {
      companyId: input.companyId,
      customerId: customer.id
    },
    attributes: ["id"],
    limit: 200
  });
  const receivableIds = receivables.map(r => r.id);

  let payments: Array<Record<string, unknown>> = [];
  if (receivableIds.length) {
    const paymentRows = await InventoryReceivablePayment.findAll({
      where: {
        companyId: input.companyId,
        receivableId: { [Op.in]: receivableIds }
      },
      include: [
        {
          model: User,
          as: "createdByUser",
          attributes: ["id", "name"],
          required: false
        },
        {
          model: InventoryReceivableInstallment,
          attributes: ["id", "sequence", "dueDate"],
          required: false
        }
      ],
      order: [
        ["paidAt", "DESC"],
        ["id", "DESC"]
      ],
      limit: 50
    });
    payments = paymentRows.map(p => ({
      id: p.id,
      receivableId: p.receivableId,
      installmentId: p.installmentId,
      installmentSequence: p.installment?.sequence ?? null,
      dueDate: p.installment?.dueDate ?? null,
      amount: roundMoney(toMoney(p.amount)),
      paymentMethod: p.paymentMethod,
      paidAt: p.paidAt,
      notes: p.notes,
      reversedAt: p.reversedAt,
      reverseOfPaymentId: p.reverseOfPaymentId,
      createdByUser: p.createdByUser
        ? { id: p.createdByUser.id, name: p.createdByUser.name }
        : null
    }));
  }

  const overrides = await InventoryStoreCreditOverride.findAll({
    where: {
      companyId: input.companyId,
      customerId: customer.id
    },
    include: [
      {
        model: User,
        as: "authorizedByUser",
        attributes: ["id", "name"],
        required: false
      }
    ],
    order: [["createdAt", "DESC"]],
    limit: 20
  });

  const base = customerToJSON(customer) as Record<string, unknown>;
  base.contact = customer.contact
    ? {
        id: customer.contact.id,
        name: customer.contact.name,
        number: customer.contact.number
      }
    : null;

  return {
    customer: base,
    credit: {
      ...credit,
      creditAvailable: computeCreditAvailable(
        credit.creditLimit,
        credit.creditUsed
      ),
      upcomingOpenAmount
    },
    installments,
    sales: sales.map(s => ({
      id: s.id,
      saleNumber: s.saleNumber,
      status: s.status,
      totalAmount: roundMoney(toMoney(s.totalAmount)),
      paidAmount: roundMoney(toMoney(s.paidAmount)),
      paymentStatus: s.paymentStatus,
      completedAt: s.completedAt,
      createdAt: s.createdAt
    })),
    payments,
    overrides: overrides.map(o => ({
      id: o.id,
      saleId: o.saleId,
      overrideType: o.overrideType,
      creditLimitAtMoment: roundMoney(toMoney(o.creditLimitAtMoment)),
      creditAvailableAtMoment: roundMoney(toMoney(o.creditAvailableAtMoment)),
      requestedAmount: roundMoney(toMoney(o.requestedAmount)),
      exceededAmount: roundMoney(toMoney(o.exceededAmount)),
      overdueOpenAmountAtMoment: roundMoney(
        toMoney(o.overdueOpenAmountAtMoment)
      ),
      reason: o.reason,
      createdAt: o.createdAt,
      authorizedByUser: o.authorizedByUser
        ? { id: o.authorizedByUser.id, name: o.authorizedByUser.name }
        : null
    }))
  };
}
