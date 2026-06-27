import AppError from "../../errors/AppError";
import InventorySettings from "../../models/InventorySettings";
import GetOrCreateInventorySettingsService from "./GetOrCreateInventorySettingsService";
import { parseDecimal } from "./inventoryTenant";

type UpdateBody = {
  defaultCommissionRate?: unknown;
  allowNegativeStock?: unknown;
  saleNumberPrefix?: unknown;
};

export default async function UpdateInventorySettingsService(input: {
  companyId: number;
  body: UpdateBody;
}): Promise<InventorySettings> {
  const settings = await GetOrCreateInventorySettingsService(input.companyId);
  const patch: Partial<InventorySettings> = {};

  if (input.body.defaultCommissionRate !== undefined) {
    const rate = parseDecimal(input.body.defaultCommissionRate, "defaultCommissionRate");
    if (rate === null || rate < 0 || rate > 100) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "Comissão deve estar entre 0 e 100.");
    }
    patch.defaultCommissionRate = rate;
  }

  if (input.body.allowNegativeStock !== undefined) {
    patch.allowNegativeStock =
      input.body.allowNegativeStock === true ||
      input.body.allowNegativeStock === "true" ||
      input.body.allowNegativeStock === 1 ||
      input.body.allowNegativeStock === "1";
  }

  if (input.body.saleNumberPrefix !== undefined) {
    if (input.body.saleNumberPrefix === null || input.body.saleNumberPrefix === "") {
      patch.saleNumberPrefix = null;
    } else {
      const prefix = String(input.body.saleNumberPrefix).trim();
      if (prefix.length > 16) {
        throw new AppError("ERR_VALIDATION_ERROR", 400, "Prefixo muito longo (máx. 16).");
      }
      patch.saleNumberPrefix = prefix || null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return settings;
  }

  await settings.update(patch);
  return settings.reload();
}
