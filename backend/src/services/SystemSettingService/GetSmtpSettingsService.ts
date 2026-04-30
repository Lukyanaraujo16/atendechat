import SystemSetting from "../../models/SystemSetting";
import { SMTP_SETTING_KEYS } from "./smtpSettingKeys";

export type SmtpSettingsPublic = {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
  secure: boolean;
  requireTls: boolean;
  replyTo: string;
};

function parseBool(v: string | undefined): boolean {
  return v === "true" || v === "1";
}

const GetSmtpSettingsService = async (): Promise<SmtpSettingsPublic> => {
  const keys = Object.values(SMTP_SETTING_KEYS) as string[];
  const rows = await SystemSetting.findAll({ where: { key: keys } });
  const m: Record<string, string> = {};
  rows.forEach((r) => {
    m[r.key] = r.value ?? "";
  });

  const portRaw = String(m[SMTP_SETTING_KEYS.port] || "").trim();
  const port = portRaw ? parseInt(portRaw, 10) : 587;

  return {
    enabled: parseBool(m[SMTP_SETTING_KEYS.enabled]),
    host: String(m[SMTP_SETTING_KEYS.host] || "").trim(),
    port: Number.isFinite(port) && port > 0 && port <= 65535 ? port : 587,
    user: String(m[SMTP_SETTING_KEYS.user] || "").trim(),
    hasPassword: !!String(m[SMTP_SETTING_KEYS.password] || "").trim(),
    fromName: String(m[SMTP_SETTING_KEYS.fromName] || "").trim(),
    fromEmail: String(m[SMTP_SETTING_KEYS.fromEmail] || "").trim(),
    secure: parseBool(m[SMTP_SETTING_KEYS.secure]),
    requireTls: parseBool(m[SMTP_SETTING_KEYS.requireTls]),
    replyTo: String(m[SMTP_SETTING_KEYS.replyTo] || "").trim()
  };
};

export default GetSmtpSettingsService;
