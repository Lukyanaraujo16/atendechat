import CrmCustomField from "../../models/CrmCustomField";
import CrmPipeline from "../../models/CrmPipeline";
import AppError from "../../errors/AppError";
import type { CrmCustomFieldType } from "../../models/CrmCustomField";

const ALLOWED_TYPES: CrmCustomFieldType[] = [
  "text",
  "number",
  "currency",
  "date",
  "select",
  "boolean"
];

function normalizeOptionsForSelect(options: unknown): string[] | null {
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

export default async function UpdateCrmCustomFieldService(input: {
  companyId: number;
  id: number;
  label?: string;
  type?: CrmCustomFieldType;
  options?: unknown;
  required?: boolean;
  visibleOnCard?: boolean;
  position?: number;
  active?: boolean;
  pipelineId?: number | null;
}): Promise<CrmCustomField> {
  const row = await CrmCustomField.findOne({
    where: { id: input.id, companyId: input.companyId }
  });
  if (!row) {
    throw new AppError("ERR_CRM_CUSTOM_FIELD_NOT_FOUND", 404);
  }

  if (input.pipelineId !== undefined && input.pipelineId !== row.pipelineId) {
    if (input.pipelineId != null) {
      const p = await CrmPipeline.findOne({
        where: { id: input.pipelineId, companyId: input.companyId }
      });
      if (!p) {
        throw new AppError("ERR_NO_CRM_PIPELINE", 404);
      }
    }
    row.pipelineId = input.pipelineId;
  }

  if (input.label !== undefined) {
    const label = String(input.label || "").trim();
    if (!label) {
      throw new AppError("ERR_VALIDATION", 400);
    }
    row.label = label;
  }

  const nextType = input.type ?? row.type;
  if (input.type != null) {
    if (!ALLOWED_TYPES.includes(input.type)) {
      throw new AppError("ERR_CRM_CUSTOM_FIELD_INVALID", 400);
    }
    row.type = input.type;
  }

  if (nextType === "select") {
    if (input.options !== undefined) {
      row.options = normalizeOptionsForSelect(input.options);
    } else if (input.type === "select" && (!row.options || !row.options.length)) {
      throw new AppError("ERR_CRM_CUSTOM_FIELD_OPTIONS", 400);
    }
  } else if (input.type != null && input.type !== "select") {
    row.options = null;
  }

  if (input.required !== undefined) row.required = Boolean(input.required);
  if (input.visibleOnCard !== undefined) {
    row.visibleOnCard = Boolean(input.visibleOnCard);
  }
  if (input.position !== undefined && Number.isFinite(Number(input.position))) {
    row.position = Number(input.position);
  }
  if (input.active !== undefined) row.active = Boolean(input.active);

  await row.save();
  return row;
}
