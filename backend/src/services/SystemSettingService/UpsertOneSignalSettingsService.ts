import SystemSetting from "../../models/SystemSetting";
import {
  ONESIGNAL_SETTING_KEYS,
  OneSignalEnvironment
} from "./oneSignalSettingKeys";

export type OneSignalSettingsInput = {
  appId?: string;
  /** Omitir para não alterar a chave já guardada. String vazia remove. */
  restApiKey?: string | null;
  enabled?: boolean;
  environment?: OneSignalEnvironment;
};

async function upsertKey(key: string, value: string): Promise<void> {
  const existing = await SystemSetting.findOne({ where: { key } });
  if (existing) {
    await existing.update({ value });
  } else {
    await SystemSetting.create({ key, value });
  }
}

const UpsertOneSignalSettingsService = async (
  data: OneSignalSettingsInput
): Promise<void> => {
  if (data.appId !== undefined) {
    await upsertKey(ONESIGNAL_SETTING_KEYS.appId, String(data.appId).trim());
  }
  if (data.restApiKey !== undefined) {
    await upsertKey(
      ONESIGNAL_SETTING_KEYS.restApiKey,
      data.restApiKey == null ? "" : String(data.restApiKey).trim()
    );
  }
  if (data.enabled !== undefined) {
    await upsertKey(ONESIGNAL_SETTING_KEYS.enabled, data.enabled ? "true" : "false");
  }
  if (data.environment !== undefined) {
    const env: OneSignalEnvironment =
      data.environment === "development" ? "development" : "production";
    await upsertKey(ONESIGNAL_SETTING_KEYS.environment, env);
  }
};

export default UpsertOneSignalSettingsService;
