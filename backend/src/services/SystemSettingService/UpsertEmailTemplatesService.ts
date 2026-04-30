import SystemSetting from "../../models/SystemSetting";
import { EMAIL_TEMPLATE_SETTING_KEYS } from "./emailTemplateSettingKeys";
import GetEmailTemplatesService from "./GetEmailTemplatesService";

export type UpsertEmailTemplatesInput = {
  welcomeSubject?: string;
  welcomeBody?: string;
  passwordResetSubject?: string;
  passwordResetBody?: string;
  supportEmail?: string;
  loginUrl?: string;
};

async function upsertKey(key: string, value: string): Promise<void> {
  const existing = await SystemSetting.findOne({ where: { key } });
  if (existing) {
    await existing.update({ value });
  } else {
    await SystemSetting.create({ key, value });
  }
}

const UpsertEmailTemplatesService = async (
  data: UpsertEmailTemplatesInput
): Promise<ReturnType<typeof GetEmailTemplatesService>> => {
  if (data.welcomeSubject !== undefined) {
    await upsertKey(
      EMAIL_TEMPLATE_SETTING_KEYS.welcomeSubject,
      String(data.welcomeSubject ?? "")
    );
  }
  if (data.welcomeBody !== undefined) {
    await upsertKey(
      EMAIL_TEMPLATE_SETTING_KEYS.welcomeBody,
      String(data.welcomeBody ?? "")
    );
  }
  if (data.passwordResetSubject !== undefined) {
    await upsertKey(
      EMAIL_TEMPLATE_SETTING_KEYS.passwordResetSubject,
      String(data.passwordResetSubject ?? "")
    );
  }
  if (data.passwordResetBody !== undefined) {
    await upsertKey(
      EMAIL_TEMPLATE_SETTING_KEYS.passwordResetBody,
      String(data.passwordResetBody ?? "")
    );
  }
  if (data.supportEmail !== undefined) {
    await upsertKey(
      EMAIL_TEMPLATE_SETTING_KEYS.supportEmail,
      String(data.supportEmail ?? "").trim().toLowerCase()
    );
  }
  if (data.loginUrl !== undefined) {
    const u = String(data.loginUrl ?? "").trim();
    await upsertKey(EMAIL_TEMPLATE_SETTING_KEYS.loginUrl, u.replace(/\/$/, ""));
  }

  return GetEmailTemplatesService();
};

export default UpsertEmailTemplatesService;
