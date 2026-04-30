import SystemSetting from "../../models/SystemSetting";
import { EMAIL_TEMPLATE_SETTING_KEYS } from "./emailTemplateSettingKeys";
import {
  DEFAULT_PASSWORD_RESET_BODY,
  DEFAULT_PASSWORD_RESET_SUBJECT,
  DEFAULT_WELCOME_BODY,
  DEFAULT_WELCOME_SUBJECT
} from "./defaultEmailTemplates";

export type EmailTemplatesPublic = {
  welcomeSubject: string;
  welcomeBody: string;
  passwordResetSubject: string;
  passwordResetBody: string;
  supportEmail: string;
  loginUrl: string;
};

function pickMerged(stored: string | undefined, fallback: string): string {
  const t = String(stored ?? "").trim();
  return t.length > 0 ? String(stored) : fallback;
}

/** Valores efetivos para UI e envio (BD não vazia → BD; senão padrão). */
const GetEmailTemplatesService = async (): Promise<EmailTemplatesPublic> => {
  const keys = Object.values(EMAIL_TEMPLATE_SETTING_KEYS) as string[];
  const rows = await SystemSetting.findAll({ where: { key: keys } });
  const m: Record<string, string> = {};
  rows.forEach((r) => {
    m[r.key] = r.value ?? "";
  });

  return {
    welcomeSubject: pickMerged(
      m[EMAIL_TEMPLATE_SETTING_KEYS.welcomeSubject],
      DEFAULT_WELCOME_SUBJECT
    ),
    welcomeBody: pickMerged(
      m[EMAIL_TEMPLATE_SETTING_KEYS.welcomeBody],
      DEFAULT_WELCOME_BODY
    ),
    passwordResetSubject: pickMerged(
      m[EMAIL_TEMPLATE_SETTING_KEYS.passwordResetSubject],
      DEFAULT_PASSWORD_RESET_SUBJECT
    ),
    passwordResetBody: pickMerged(
      m[EMAIL_TEMPLATE_SETTING_KEYS.passwordResetBody],
      DEFAULT_PASSWORD_RESET_BODY
    ),
    supportEmail: String(m[EMAIL_TEMPLATE_SETTING_KEYS.supportEmail] ?? "").trim(),
    loginUrl: String(m[EMAIL_TEMPLATE_SETTING_KEYS.loginUrl] ?? "").trim()
  };
};

export default GetEmailTemplatesService;
