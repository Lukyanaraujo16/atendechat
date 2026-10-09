import AppError from "../../errors/AppError";
import InventorySettings from "../../models/InventorySettings";
import GetOrCreateInventorySettingsService from "./GetOrCreateInventorySettingsService";
import { isReceiptPrintFormat } from "./inventoryReceiptPrintFormat";
import { parseDecimal } from "./inventoryTenant";

type UpdateBody = {
  defaultCommissionRate?: unknown;
  allowNegativeStock?: unknown;
  saleNumberPrefix?: unknown;
  receiptTradeName?: unknown;
  receiptLegalName?: unknown;
  receiptDocument?: unknown;
  receiptPhone?: unknown;
  receiptAddress?: unknown;
  receiptFooterMessage?: unknown;
  receiptPrintFormat?: unknown;
  blockStoreCreditWhenOverdue?: unknown;
  maxDiscountPercentWithoutAuthorization?: unknown;
};

const RECEIPT_TEXT_FIELDS: Array<{
  key:
    | "receiptTradeName"
    | "receiptLegalName"
    | "receiptDocument"
    | "receiptPhone"
    | "receiptAddress"
    | "receiptFooterMessage";
  max: number;
  label: string;
}> = [
  { key: "receiptTradeName", max: 120, label: "Nome fantasia" },
  { key: "receiptLegalName", max: 160, label: "Razão social" },
  { key: "receiptDocument", max: 32, label: "Documento" },
  { key: "receiptPhone", max: 32, label: "Telefone" },
  { key: "receiptAddress", max: 255, label: "Endereço" },
  { key: "receiptFooterMessage", max: 500, label: "Mensagem de rodapé" }
];

function normalizeReceiptText(
  value: unknown,
  max: number,
  label: string
): string | null {
  if (value === null) return null;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new AppError("ERR_VALIDATION_ERROR", 400, `${label} inválido.`);
  }
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `${label} deve ter no máximo ${max} caracteres.`
    );
  }
  return text;
}

export default async function UpdateInventorySettingsService(input: {
  companyId: number;
  body: UpdateBody & {
    companyId?: unknown;
    nextSaleNumber?: unknown;
  };
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

  if (input.body.blockStoreCreditWhenOverdue !== undefined) {
    patch.blockStoreCreditWhenOverdue =
      input.body.blockStoreCreditWhenOverdue === true ||
      input.body.blockStoreCreditWhenOverdue === "true" ||
      input.body.blockStoreCreditWhenOverdue === 1 ||
      input.body.blockStoreCreditWhenOverdue === "1";
  }

  if (input.body.maxDiscountPercentWithoutAuthorization !== undefined) {
    const max = parseDecimal(
      input.body.maxDiscountPercentWithoutAuthorization,
      "maxDiscountPercentWithoutAuthorization"
    );
    if (max === null || max < 0 || max > 100) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "Limite de desconto sem autorização deve estar entre 0 e 100."
      );
    }
    patch.maxDiscountPercentWithoutAuthorization = max;
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

  RECEIPT_TEXT_FIELDS.forEach(field => {
    if (input.body[field.key] !== undefined) {
      patch[field.key] = normalizeReceiptText(
        input.body[field.key],
        field.max,
        field.label
      );
    }
  });

  if (input.body.receiptPrintFormat !== undefined) {
    const requestedFormat = input.body.receiptPrintFormat;
    if (!isReceiptPrintFormat(requestedFormat)) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "Formato de impressão inválido."
      );
    }
    patch.receiptPrintFormat = requestedFormat;
  }

  if (Object.keys(patch).length === 0) {
    return settings;
  }

  await settings.update(patch);
  return settings.reload();
}
