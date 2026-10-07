import AppError from "../../errors/AppError";
import InventoryDeliveryMethod from "../../models/InventoryDeliveryMethod";
import {
  assertPickupInvariants,
  defaultAllowAmountOverrideForKind,
  defaultRequiresAddressForKind,
  parseDeliveryKind,
  parseNonNegativeMoney
} from "./inventoryDeliveryHelpers";
import { normalizeOptionalString } from "./inventoryTenant";

type CreateBody = {
  name?: unknown;
  kind?: unknown;
  defaultAmount?: unknown;
  allowAmountOverride?: unknown;
  requiresAddress?: unknown;
  active?: unknown;
  position?: unknown;
};

function parseBool(raw: unknown, fallback: boolean): boolean {
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (raw === true || raw === "true" || raw === 1 || raw === "1") return true;
  if (raw === false || raw === "false" || raw === 0 || raw === "0") return false;
  throw new AppError("ERR_VALIDATION_ERROR", 400, "Valor booleano inválido.");
}

export default async function CreateInventoryDeliveryMethodService(input: {
  companyId: number;
  body: CreateBody;
}): Promise<InventoryDeliveryMethod> {
  const name = normalizeOptionalString(input.body.name, 120);
  if (!name) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Nome da modalidade é obrigatório."
    );
  }

  const kind = parseDeliveryKind(input.body.kind);
  const defaultAmount =
    input.body.defaultAmount === undefined ||
    input.body.defaultAmount === null ||
    input.body.defaultAmount === ""
      ? 0
      : parseNonNegativeMoney(input.body.defaultAmount, "defaultAmount");

  const allowAmountOverride = parseBool(
    input.body.allowAmountOverride,
    defaultAllowAmountOverrideForKind(kind)
  );
  const requiresAddress = parseBool(
    input.body.requiresAddress,
    defaultRequiresAddressForKind(kind)
  );
  const active = parseBool(input.body.active, true);

  const position =
    input.body.position !== undefined && input.body.position !== null
      ? Number(input.body.position)
      : 0;
  if (!Number.isFinite(position)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "position inválido.");
  }

  assertPickupInvariants({
    kind,
    defaultAmount,
    allowAmountOverride,
    requiresAddress
  });

  return InventoryDeliveryMethod.create({
    companyId: input.companyId,
    name,
    kind,
    defaultAmount,
    allowAmountOverride,
    requiresAddress,
    active,
    position: Math.trunc(position)
  });
}
