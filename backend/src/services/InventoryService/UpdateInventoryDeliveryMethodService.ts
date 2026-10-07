import AppError from "../../errors/AppError";
import InventoryDeliveryMethod from "../../models/InventoryDeliveryMethod";
import {
  assertPickupInvariants,
  parseDeliveryKind,
  parseNonNegativeMoney
} from "./inventoryDeliveryHelpers";
import { normalizeOptionalString } from "./inventoryTenant";

type UpdateBody = {
  name?: unknown;
  kind?: unknown;
  defaultAmount?: unknown;
  allowAmountOverride?: unknown;
  requiresAddress?: unknown;
  active?: unknown;
  position?: unknown;
};

function parseBool(raw: unknown): boolean {
  if (raw === true || raw === "true" || raw === 1 || raw === "1") return true;
  if (raw === false || raw === "false" || raw === 0 || raw === "0") return false;
  throw new AppError("ERR_VALIDATION_ERROR", 400, "Valor booleano inválido.");
}

async function findMethodOrThrow(
  companyId: number,
  id: number
): Promise<InventoryDeliveryMethod> {
  const row = await InventoryDeliveryMethod.findOne({
    where: { id, companyId }
  });
  if (!row) {
    throw new AppError("ERR_INVENTORY_DELIVERY_METHOD_NOT_FOUND", 404);
  }
  return row;
}

export default async function UpdateInventoryDeliveryMethodService(input: {
  companyId: number;
  id: number;
  body: UpdateBody;
}): Promise<InventoryDeliveryMethod> {
  const method = await findMethodOrThrow(input.companyId, input.id);
  const patch: Partial<InventoryDeliveryMethod> = {};

  if (input.body.name !== undefined) {
    const name = normalizeOptionalString(input.body.name, 120);
    if (!name) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "Nome da modalidade é obrigatório."
      );
    }
    patch.name = name;
  }

  if (input.body.kind !== undefined) {
    patch.kind = parseDeliveryKind(input.body.kind);
  }

  if (input.body.defaultAmount !== undefined) {
    patch.defaultAmount = parseNonNegativeMoney(
      input.body.defaultAmount,
      "defaultAmount"
    );
  }

  if (input.body.allowAmountOverride !== undefined) {
    patch.allowAmountOverride = parseBool(input.body.allowAmountOverride);
  }

  if (input.body.requiresAddress !== undefined) {
    patch.requiresAddress = parseBool(input.body.requiresAddress);
  }

  if (input.body.active !== undefined) {
    patch.active = parseBool(input.body.active);
  }

  if (input.body.position !== undefined && input.body.position !== null) {
    const position = Number(input.body.position);
    if (!Number.isFinite(position)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "position inválido.");
    }
    patch.position = Math.trunc(position);
  }

  const nextKind = (patch.kind ?? method.kind) as typeof method.kind;
  const nextDefault =
    patch.defaultAmount !== undefined
      ? Number(patch.defaultAmount)
      : Number(method.defaultAmount);
  const nextOverride =
    patch.allowAmountOverride !== undefined
      ? patch.allowAmountOverride
      : method.allowAmountOverride;
  const nextRequires =
    patch.requiresAddress !== undefined
      ? patch.requiresAddress
      : method.requiresAddress;

  assertPickupInvariants({
    kind: nextKind,
    defaultAmount: nextDefault,
    allowAmountOverride: nextOverride,
    requiresAddress: nextRequires
  });

  await method.update(patch);
  return method.reload();
}
