import { Op } from "sequelize";
import CrmCustomField from "../../models/CrmCustomField";
import AppError from "../../errors/AppError";
import type { CrmCustomFieldType } from "../../models/CrmCustomField";

function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string" && !String(v).trim()) return true;
  return false;
}

function coerceBoolean(v: unknown): boolean {
  if (v === true || v === false) return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  throw new AppError("ERR_CRM_CUSTOM_FIELD_INVALID", 400);
}

function coerceNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(",", ".").trim());
  if (!Number.isFinite(n)) {
    throw new AppError("ERR_CRM_CUSTOM_FIELD_INVALID", 400);
  }
  return n;
}

function coerceDate(v: unknown): string {
  if (v == null || v === "") {
    throw new AppError("ERR_CRM_CUSTOM_FIELD_INVALID", 400);
  }
  if (typeof v === "string") {
    const s = v.trim();
    const d = new Date(s.includes("T") ? s : `${s}T12:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) {
      return s.slice(0, 10).length === 10 ? s.slice(0, 10) : d.toISOString().slice(0, 10);
    }
    throw new AppError("ERR_CRM_CUSTOM_FIELD_INVALID", 400);
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  throw new AppError("ERR_CRM_CUSTOM_FIELD_INVALID", 400);
}

function coerceText(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeOne(
  def: CrmCustomField,
  raw: unknown
): string | number | boolean {
  const t = def.type as CrmCustomFieldType;
  switch (t) {
    case "text":
      return coerceText(raw);
    case "number":
    case "currency":
      return coerceNumber(raw);
    case "date":
      return coerceDate(raw);
    case "boolean":
      return coerceBoolean(raw);
    case "select": {
      const s = coerceText(raw);
      const opts = def.options || [];
      if (!opts.includes(s)) {
        throw new AppError("ERR_CRM_CUSTOM_FIELD_INVALID", 400);
      }
      return s;
    }
    default:
      throw new AppError("ERR_CRM_CUSTOM_FIELD_INVALID", 400);
  }
}

export default async function ValidateCrmDealCustomFieldsService(input: {
  companyId: number;
  pipelineId: number;
  raw: unknown;
  existing: Record<string, unknown> | null;
  mode: "create" | "update";
}): Promise<Record<string, unknown>> {
  const existing = input.existing && typeof input.existing === "object"
    ? { ...input.existing }
    : {};

  const activeDefs = await CrmCustomField.findAll({
    where: {
      companyId: input.companyId,
      active: true,
      [Op.or]: [{ pipelineId: null }, { pipelineId: input.pipelineId }]
    },
    order: [
      ["position", "ASC"],
      ["id", "ASC"]
    ]
  });

  if (!activeDefs.length) {
    if (input.mode === "update" && input.raw === undefined) {
      return existing;
    }
    if (input.raw == null || (typeof input.raw === "object" && !Object.keys(input.raw as object).length)) {
      return existing;
    }
    throw new AppError("ERR_CRM_CUSTOM_FIELD_UNKNOWN", 400);
  }

  const activeKeys = new Set(activeDefs.map((d) => d.key));
  const defByKey = new Map(activeDefs.map((d) => [d.key, d]));

  const rawObj =
    input.raw != null && typeof input.raw === "object" && !Array.isArray(input.raw)
      ? (input.raw as Record<string, unknown>)
      : null;

  if (input.mode === "update" && input.raw === undefined) {
    return existing;
  }

  const merged: Record<string, unknown> = { ...existing };

  if (rawObj) {
    for (const key of Object.keys(rawObj)) {
      if (!activeKeys.has(key)) continue;
      const def = defByKey.get(key);
      if (!def) continue;
      const rawVal = rawObj[key];
      if (rawVal === null && !def.required) {
        delete merged[key];
        continue;
      }
      if (
        (rawVal === "" || rawVal === undefined) &&
        !def.required &&
        def.type !== "boolean"
      ) {
        delete merged[key];
        continue;
      }
      try {
        merged[key] = normalizeOne(def, rawVal);
      } catch (e) {
        if (e instanceof AppError) throw e;
        throw new AppError("ERR_CRM_CUSTOM_FIELD_INVALID", 400);
      }
    }
  }

  for (const def of activeDefs) {
    if (!def.required) continue;
    const v = merged[def.key];
    if (def.type === "boolean") {
      if (v !== true && v !== false) {
        throw new AppError("ERR_CRM_CUSTOM_FIELD_REQUIRED", 400);
      }
      continue;
    }
    if (isEmptyValue(v)) {
      throw new AppError("ERR_CRM_CUSTOM_FIELD_REQUIRED", 400);
    }
  }

  return merged;
}
