import SystemSetting from "../../models/SystemSetting";
import { ONESIGNAL_SETTING_KEYS } from "../SystemSettingService/oneSignalSettingKeys";

export type OneSignalServerSettings = {
  enabled: boolean;
  appId: string;
  restApiKey: string;
};

const readKey = async (key: string): Promise<string> => {
  const row = await SystemSetting.findOne({ where: { key } });
  return row?.value != null ? String(row.value).trim() : "";
};

const GetOneSignalServerSettingsService =
  async (): Promise<OneSignalServerSettings> => {
    const [appId, restApiKey, enabledRaw] = await Promise.all([
      readKey(ONESIGNAL_SETTING_KEYS.appId),
      readKey(ONESIGNAL_SETTING_KEYS.restApiKey),
      readKey(ONESIGNAL_SETTING_KEYS.enabled)
    ]);

    const enabled =
      enabledRaw === "true" || enabledRaw === "1" || enabledRaw === "yes";

    return {
      enabled,
      appId,
      restApiKey
    };
  };

export default GetOneSignalServerSettingsService;
