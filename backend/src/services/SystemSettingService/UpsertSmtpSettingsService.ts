import SystemSetting from "../../models/SystemSetting";
import AppError from "../../errors/AppError";
import { SMTP_SETTING_KEYS } from "./smtpSettingKeys";
import GetSmtpSettingsService from "./GetSmtpSettingsService";

export type UpsertSmtpSettingsInput = {
  enabled?: boolean;
  host?: string;
  port?: number;
  user?: string;
  /** Gravada apenas se string não vazia. */
  password?: string | null;
  /** Remove a senha guardada. */
  clearPassword?: boolean;
  fromName?: string;
  fromEmail?: string;
  secure?: boolean;
  requireTls?: boolean;
  replyTo?: string | null;
};

async function upsertKey(key: string, value: string): Promise<void> {
  const existing = await SystemSetting.findOne({ where: { key } });
  if (existing) {
    await existing.update({ value });
  } else {
    await SystemSetting.create({ key, value });
  }
}

const UpsertSmtpSettingsService = async (
  data: UpsertSmtpSettingsInput
): Promise<ReturnType<typeof GetSmtpSettingsService>> => {
  if (data.port !== undefined) {
    const p = Number(data.port);
    if (!Number.isFinite(p) || p <= 0 || p > 65535) {
      throw new AppError("ERR_SMTP_INVALID_PORT", 400, "Porta SMTP inválida.");
    }
    await upsertKey(SMTP_SETTING_KEYS.port, String(Math.trunc(p)));
  }

  if (data.enabled !== undefined) {
    await upsertKey(
      SMTP_SETTING_KEYS.enabled,
      data.enabled ? "true" : "false"
    );
  }
  if (data.host !== undefined) {
    await upsertKey(SMTP_SETTING_KEYS.host, String(data.host).trim());
  }
  if (data.user !== undefined) {
    await upsertKey(SMTP_SETTING_KEYS.user, String(data.user).trim());
  }
  if (data.fromName !== undefined) {
    await upsertKey(SMTP_SETTING_KEYS.fromName, String(data.fromName).trim());
  }
  if (data.fromEmail !== undefined) {
    await upsertKey(
      SMTP_SETTING_KEYS.fromEmail,
      String(data.fromEmail).trim().toLowerCase()
    );
  }
  if (data.secure !== undefined) {
    await upsertKey(SMTP_SETTING_KEYS.secure, data.secure ? "true" : "false");
  }
  if (data.requireTls !== undefined) {
    await upsertKey(
      SMTP_SETTING_KEYS.requireTls,
      data.requireTls ? "true" : "false"
    );
  }
  if (data.replyTo !== undefined) {
    const v =
      data.replyTo == null ? "" : String(data.replyTo).trim().toLowerCase();
    await upsertKey(SMTP_SETTING_KEYS.replyTo, v);
  }

  if (data.clearPassword === true) {
    await upsertKey(SMTP_SETTING_KEYS.password, "");
  } else if (
    data.password !== undefined &&
    data.password !== null &&
    String(data.password).length > 0
  ) {
    await upsertKey(SMTP_SETTING_KEYS.password, String(data.password));
  }

  return GetSmtpSettingsService();
};

export default UpsertSmtpSettingsService;
