import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import InventoryDiscountAuthorization from "../../models/InventoryDiscountAuthorization";
import InventorySale from "../../models/InventorySale";
import InventorySaleItem from "../../models/InventorySaleItem";
import InventorySettings from "../../models/InventorySettings";
import User from "../../models/User";
import {
  computeGlobalDiscountAmount,
  computeItemDiscountAmount,
  merchandiseEffectiveDiscountPercent
} from "./inventoryDiscountHelpers";
import { roundMoney, toMoney } from "./inventorySaleHelpers";

export type DiscountAuthorizationInput = {
  authorize?: boolean;
  authorizedByUserId?: number | null;
  reason?: string | null;
  canAuthorizeDiscount?: boolean;
};

export type MerchandiseDiscountSnapshot = {
  grossMerchandise: number;
  itemDiscountTotal: number;
  merchandiseAfterItemDiscounts: number;
  globalDiscountAmount: number;
  netMerchandise: number;
  effectivePercent: number;
  maxAllowedPercent: number;
  exceedsLimit: boolean;
};

export async function loadMaxDiscountPercent(
  companyId: number,
  transaction?: Transaction
): Promise<number> {
  const settings = await InventorySettings.findOne({
    where: { companyId },
    transaction
  });
  const max = settings
    ? toMoney(settings.maxDiscountPercentWithoutAuthorization ?? 100)
    : 100;
  if (!Number.isFinite(max) || max < 0) return 100;
  return roundMoney(Math.min(100, max));
}

export function buildMerchandiseDiscountSnapshot(input: {
  items: Array<{
    unitPrice: string | number;
    quantity: string | number;
    discountType?: string | null;
    discountAmount?: string | number | null;
    discountPercent?: string | number | null;
  }>;
  globalDiscountType?: string | null;
  globalDiscountAmount?: string | number | null;
  globalDiscountPercent?: string | number | null;
  maxAllowedPercent: number;
}): MerchandiseDiscountSnapshot {
  let grossMerchandise = 0;
  let itemDiscountTotal = 0;
  let merchandiseAfterItemDiscounts = 0;

  for (const item of input.items) {
    const computed = computeItemDiscountAmount({
      discountType: item.discountType,
      discountAmount: item.discountAmount,
      discountPercent: item.discountPercent,
      unitPrice: toMoney(item.unitPrice),
      quantity: Number(item.quantity)
    });
    grossMerchandise += computed.lineGross;
    itemDiscountTotal += computed.discountAmount;
    merchandiseAfterItemDiscounts += computed.lineTotal;
  }

  grossMerchandise = roundMoney(grossMerchandise);
  itemDiscountTotal = roundMoney(itemDiscountTotal);
  merchandiseAfterItemDiscounts = roundMoney(merchandiseAfterItemDiscounts);

  const global = computeGlobalDiscountAmount({
    globalDiscountType: input.globalDiscountType,
    globalDiscountAmount: input.globalDiscountAmount,
    globalDiscountPercent: input.globalDiscountPercent,
    merchandiseAfterItemDiscounts
  });

  const effectivePercent = merchandiseEffectiveDiscountPercent({
    grossMerchandise,
    itemDiscountTotal,
    globalDiscountAmount: global.globalDiscountAmount
  });

  const maxAllowedPercent = roundMoney(input.maxAllowedPercent);
  const exceedsLimit =
    effectivePercent > maxAllowedPercent + 1e-9 &&
    itemDiscountTotal + global.globalDiscountAmount > 1e-9;

  return {
    grossMerchandise,
    itemDiscountTotal,
    merchandiseAfterItemDiscounts,
    globalDiscountAmount: global.globalDiscountAmount,
    netMerchandise: global.netMerchandise,
    effectivePercent,
    maxAllowedPercent,
    exceedsLimit
  };
}

export async function snapshotSaleMerchandiseDiscount(
  sale: InventorySale,
  transaction?: Transaction
): Promise<MerchandiseDiscountSnapshot> {
  const items = await InventorySaleItem.findAll({
    where: { saleId: sale.id, companyId: sale.companyId },
    transaction
  });
  const maxAllowedPercent = await loadMaxDiscountPercent(
    sale.companyId,
    transaction
  );
  return buildMerchandiseDiscountSnapshot({
    items,
    globalDiscountType: sale.globalDiscountType,
    globalDiscountAmount: sale.globalDiscountAmount,
    globalDiscountPercent: sale.globalDiscountPercent,
    maxAllowedPercent
  });
}

function normalizeReason(reason: unknown): string {
  if (reason == null) {
    throw new AppError(
      "ERR_INVENTORY_DISCOUNT_AUTH_REASON_REQUIRED",
      400,
      "Informe o motivo da autorização do desconto."
    );
  }
  const text = String(reason).trim();
  if (text.length < 3) {
    throw new AppError(
      "ERR_INVENTORY_DISCOUNT_AUTH_REASON_REQUIRED",
      400,
      "Informe o motivo da autorização do desconto (mín. 3 caracteres)."
    );
  }
  if (text.length > 2000) {
    throw new AppError(
      "ERR_INVENTORY_DISCOUNT_AUTH_REASON_TOO_LONG",
      400,
      "Motivo da autorização muito longo."
    );
  }
  return text;
}

/**
 * Valida governança do desconto efetivo total da mercadoria.
 * Se exceder o limite, exige autorização com permissão + motivo e grava auditoria.
 */
export async function assertMerchandiseDiscountGovernance(input: {
  companyId: number;
  sale: InventorySale;
  snapshot: MerchandiseDiscountSnapshot;
  authorization?: DiscountAuthorizationInput;
  actorUserId?: number | null;
  transaction: Transaction;
}): Promise<InventoryDiscountAuthorization | null> {
  if (!input.snapshot.exceedsLimit) {
    return null;
  }

  const auth = input.authorization;
  const authorized =
    auth?.authorize === true &&
    auth?.canAuthorizeDiscount === true &&
    auth?.authorizedByUserId != null;

  if (!authorized) {
    throw new AppError(
      "ERR_INVENTORY_DISCOUNT_AUTHORIZATION_REQUIRED",
      400,
      `Desconto efetivo (${input.snapshot.effectivePercent}%) acima do limite sem autorização (${input.snapshot.maxAllowedPercent}%).`
    );
  }

  const authorizedByUserId = Number(auth.authorizedByUserId);
  const authorizer = await User.findOne({
    where: { id: authorizedByUserId, companyId: input.companyId },
    transaction: input.transaction
  });
  if (!authorizer) {
    throw new AppError(
      "ERR_NO_USER_FOUND",
      404,
      "Usuário autorizador do desconto inválido."
    );
  }

  const reason = normalizeReason(auth.reason);

  return InventoryDiscountAuthorization.create(
    {
      companyId: input.companyId,
      saleId: input.sale.id,
      authorizedByUserId,
      reason,
      effectiveDiscountPercent: roundMoney(input.snapshot.effectivePercent),
      maxAllowedPercent: roundMoney(input.snapshot.maxAllowedPercent),
      merchandiseAfterItemDiscounts: input.snapshot.merchandiseAfterItemDiscounts,
      itemDiscountTotal: input.snapshot.itemDiscountTotal,
      globalDiscountAmount: input.snapshot.globalDiscountAmount,
      netMerchandise: input.snapshot.netMerchandise
    },
    { transaction: input.transaction }
  );
}

export function assertCanApplyDiscount(input: {
  canApplyDiscount: boolean;
  discountAmount: number;
}): void {
  if (input.discountAmount > 1e-9 && input.canApplyDiscount !== true) {
    throw new AppError(
      "ERR_NO_PERMISSION",
      403,
      "Sem permissão para conceder desconto."
    );
  }
}
