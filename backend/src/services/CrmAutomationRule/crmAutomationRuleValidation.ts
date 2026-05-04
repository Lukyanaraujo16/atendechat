import * as Yup from "yup";
import AppError from "../../errors/AppError";
import {
  CrmAutomationTriggerType,
  CrmAutomationActionType
} from "../../models/CrmAutomationRule";

const TRIGGER_TYPES: CrmAutomationTriggerType[] = [
  "stage_changed",
  "stale_for_days",
  "priority_changed"
];

const ACTION_TYPES: CrmAutomationActionType[] = [
  "create_follow_up",
  "mark_attention",
  "notify_user"
];

const triggerConfigSchema = Yup.object({
  stageId: Yup.number().integer().nullable(),
  days: Yup.number().integer().min(1).max(365).nullable(),
  priority: Yup.string().max(16).nullable()
});

const actionConfigSchema = Yup.object({
  days: Yup.number().min(0).max(365).nullable(),
  note: Yup.string().max(65535).nullable(),
  reason: Yup.string().max(128).nullable()
});

const bodySchema = Yup.object({
  name: Yup.string().min(1).max(255).required(),
  enabled: Yup.boolean().nullable(),
  triggerType: Yup.string()
    .oneOf(TRIGGER_TYPES as unknown as string[])
    .required(),
  triggerConfig: Yup.object().default({}),
  actionType: Yup.string()
    .oneOf(ACTION_TYPES as unknown as string[])
    .required(),
  actionConfig: Yup.object().default({})
});

export type CrmAutomationRulePayload = Yup.InferType<typeof bodySchema>;

export function assertCrmAutomationRulePayload(
  triggerType: string,
  actionType: string,
  triggerConfig: Record<string, unknown>,
  actionConfig: Record<string, unknown>
): void {
  if (triggerType === "stale_for_days" && actionType === "create_follow_up") {
    throw new AppError("ERR_CRM_AUTOMATION_STALE_NO_FOLLOWUP", 400);
  }

  if (triggerType === "stage_changed") {
    const sid = Number(triggerConfig.stageId);
    if (!Number.isFinite(sid)) {
      throw new AppError("ERR_CRM_AUTOMATION_STAGE_ID_REQUIRED", 400);
    }
  }

  if (triggerType === "stale_for_days") {
    const days = Number(triggerConfig.days);
    if (!Number.isFinite(days) || days < 1) {
      throw new AppError("ERR_CRM_AUTOMATION_DAYS_REQUIRED", 400);
    }
  }

  if (actionType === "create_follow_up") {
    const d = Number(actionConfig.days);
    if (!Number.isFinite(d) || d < 0) {
      throw new AppError("ERR_CRM_AUTOMATION_FOLLOWUP_DAYS", 400);
    }
  }
}

export async function parseCrmAutomationRuleBody(
  body: unknown
): Promise<CrmAutomationRulePayload> {
  const parsed = await bodySchema.validate(body, { abortEarly: false });
  await triggerConfigSchema.validate(parsed.triggerConfig, { abortEarly: false });
  await actionConfigSchema.validate(parsed.actionConfig, { abortEarly: false });
  assertCrmAutomationRulePayload(
    parsed.triggerType,
    parsed.actionType,
    parsed.triggerConfig as Record<string, unknown>,
    parsed.actionConfig as Record<string, unknown>
  );
  return parsed;
}
