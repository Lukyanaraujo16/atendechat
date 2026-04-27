/** Chaves em `SystemSettings` (valores string). */
export const ONESIGNAL_SETTING_KEYS = {
  appId: "onesignal_app_id",
  restApiKey: "onesignal_rest_api_key",
  enabled: "onesignal_enabled",
  environment: "onesignal_environment"
} as const;

export type OneSignalEnvironment = "production" | "development";
