import SystemSetting from "../../models/SystemSetting";
import { ONESIGNAL_SETTING_KEYS } from "./oneSignalSettingKeys";

export type PublicPushConfig = {
  onesignalEnabled: boolean;
  onesignalAppId: string;
  onesignalEnvironment: "production" | "development";
};

const readKey = async (key: string): Promise<string> => {
  const row = await SystemSetting.findOne({ where: { key } });
  return row?.value != null ? String(row.value).trim() : "";
};

const GetPublicPushConfigService = async (): Promise<PublicPushConfig> => {
  const [appId, enabledRaw, envRaw] = await Promise.all([
    readKey(ONESIGNAL_SETTING_KEYS.appId),
    readKey(ONESIGNAL_SETTING_KEYS.enabled),
    readKey(ONESIGNAL_SETTING_KEYS.environment)
  ]);

  const enabled =
    enabledRaw === "true" || enabledRaw === "1" || enabledRaw === "yes";
  const environment: "production" | "development" =
    envRaw === "development" ? "development" : "production";

  return {
    onesignalEnabled: enabled,
    onesignalAppId: appId,
    onesignalEnvironment: environment
  };
};

export default GetPublicPushConfigService;
