import SystemSetting from "../../models/SystemSetting";
import GetSystemBillingSettingsService, {
  BILLING_AUTOMATION_KEYS,
  SystemBillingSettings
} from "./GetSystemBillingSettingsService";

export type UpsertSystemBillingSettingsInput = Partial<SystemBillingSettings>;

function clampInt(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

const UpsertSystemBillingSettingsService = async (
  partial: UpsertSystemBillingSettingsInput
): Promise<SystemBillingSettings> => {
  const current = await GetSystemBillingSettingsService();
  const next: SystemBillingSettings = { ...current, ...partial };

  next.daysBeforeDueWarning = clampInt(next.daysBeforeDueWarning, 0, 365);
  next.daysAfterDueWarning = clampInt(next.daysAfterDueWarning, 0, 365);
  next.daysAfterDueBlock = clampInt(next.daysAfterDueBlock, 0, 3650);
  next.whatsappSenderCompanyId = clampInt(
    next.whatsappSenderCompanyId,
    1,
    999_999
  );

  const pairs: [string, string][] = [
    [
      BILLING_AUTOMATION_KEYS.daysBeforeDueWarning,
      String(next.daysBeforeDueWarning)
    ],
    [
      BILLING_AUTOMATION_KEYS.daysAfterDueWarning,
      String(next.daysAfterDueWarning)
    ],
    [BILLING_AUTOMATION_KEYS.daysAfterDueBlock, String(next.daysAfterDueBlock)],
    [
      BILLING_AUTOMATION_KEYS.enableAutoBlock,
      next.enableAutoBlock ? "true" : "false"
    ],
    [
      BILLING_AUTOMATION_KEYS.enableAutoWarning,
      next.enableAutoWarning ? "true" : "false"
    ],
    [
      BILLING_AUTOMATION_KEYS.enableAutoWhatsAppWarning,
      next.enableAutoWhatsAppWarning ? "true" : "false"
    ],
    [
      BILLING_AUTOMATION_KEYS.whatsappSenderCompanyId,
      String(next.whatsappSenderCompanyId)
    ]
  ];

  for (const [key, value] of pairs) {
    await SystemSetting.upsert({ key, value });
  }

  return GetSystemBillingSettingsService();
};

export default UpsertSystemBillingSettingsService;
