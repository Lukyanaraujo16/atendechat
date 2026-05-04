import { Op } from "sequelize";
import CrmCustomField from "../../models/CrmCustomField";
import CrmPipeline from "../../models/CrmPipeline";
import AppError from "../../errors/AppError";
import { labelToCrmCustomFieldKey } from "./crmCustomFieldKey";
import type { CrmCustomFieldType } from "../../models/CrmCustomField";

const ALLOWED_TYPES: CrmCustomFieldType[] = [
  "text",
  "number",
  "currency",
  "date",
  "select",
  "boolean"
];

function normalizeOptionsSafe(type: CrmCustomFieldType, options: unknown): string[] | null {
  if (type !== "select") return null;
  if (options == null) {
    throw new AppError("ERR_CRM_CUSTOM_FIELD_OPTIONS", 400);
  }
  if (Array.isArray(options)) {
    const arr = options
      .map((o) => String(o ?? "").trim())
      .filter(Boolean)
      .slice(0, 50);
    if (arr.length < 1) {
      throw new AppError("ERR_CRM_CUSTOM_FIELD_OPTIONS", 400);
    }
    return arr;
  }
  if (typeof options === "string") {
    const arr = String(options)
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (arr.length < 1) {
      throw new AppError("ERR_CRM_CUSTOM_FIELD_OPTIONS", 400);
    }
    return arr;
  }
  throw new AppError("ERR_CRM_CUSTOM_FIELD_OPTIONS", 400);
}

export default async function CreateCrmCustomFieldService(input: {
  companyId: number;
  pipelineId: number | null;
  label: string;
  type: CrmCustomFieldType;
  options?: unknown;
  required?: boolean;
  visibleOnCard?: boolean;
  position?: number;
}): Promise<CrmCustomField> {
  const label = String(input.label || "").trim();
  if (!label) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  if (!ALLOWED_TYPES.includes(input.type)) {
    throw new AppError("ERR_CRM_CUSTOM_FIELD_INVALID", 400);
  }

  if (input.pipelineId != null) {
    const p = await CrmPipeline.findOne({
      where: { id: input.pipelineId, companyId: input.companyId }
    });
    if (!p) {
      throw new AppError("ERR_NO_CRM_PIPELINE", 404);
    }
  }

  const opt = normalizeOptionsSafe(input.type, input.options);

  let base = labelToCrmCustomFieldKey(label);
  let key = base;
  let n = 2;
  for (;;) {
    const clash = await CrmCustomField.findOne({
      where: {
        companyId: input.companyId,
        key,
        pipelineId:
          input.pipelineId == null ? { [Op.is]: null } : input.pipelineId
      }
    });
    if (!clash) break;
    key = `${base}_${n}`;
    n += 1;
    if (n > 500) {
      throw new AppError("ERR_CRM_CUSTOM_FIELD_KEY", 400);
    }
  }

  let position = input.position;
  if (position == null || !Number.isFinite(position)) {
    const maxRow = await CrmCustomField.findOne({
      where: { companyId: input.companyId },
      order: [["position", "DESC"]],
      attributes: ["position"]
    });
    position = (maxRow?.position ?? -1) + 1;
  }

  return CrmCustomField.create({
    companyId: input.companyId,
    pipelineId: input.pipelineId,
    key,
    label,
    type: input.type,
    options: opt,
    required: Boolean(input.required),
    visibleOnCard: Boolean(input.visibleOnCard),
    position,
    active: true
  });
}
