import { Op } from "sequelize";
import SystemSetting from "../../models/SystemSetting";

/** Chaves em `SystemSettings` (valor sempre string). */
export const BILLING_AUTOMATION_KEYS = {
  daysBeforeDueWarning: "billingAuto_daysBeforeDueWarning",
  daysAfterDueWarning: "billingAuto_daysAfterDueWarning",
  daysAfterDueBlock: "billingAuto_daysAfterDueBlock",
  enableAutoBlock: "billingAuto_enableAutoBlock",
  enableAutoWarning: "billingAuto_enableAutoWarning",
  enableAutoWhatsAppWarning: "billingAuto_enableAutoWhatsAppWarning",
  whatsappSenderCompanyId: "billingAuto_whatsappSenderCompanyId"
} as const;

export interface SystemBillingSettings {
  daysBeforeDueWarning: number;
  daysAfterDueWarning: number;
  daysAfterDueBlock: number;
  enableAutoBlock: boolean;
  enableAutoWarning: boolean;
  /** Avisos warning_before / warning_after também por WhatsApp (sessão da empresa remetente). */
  enableAutoWhatsAppWarning: boolean;
  /** Empresa dona da conexão WhatsApp usada para enviar (ex.: matriz id 1). */
  whatsappSenderCompanyId: number;
}

const DEFAULTS: SystemBillingSettings = {
  daysBeforeDueWarning: 3,
  daysAfterDueWarning: 1,
  daysAfterDueBlock: 3,
  enableAutoBlock: true,
  enableAutoWarning: true,
  enableAutoWhatsAppWarning: false,
  whatsappSenderCompanyId: 1
};

function clampInt(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/**
 * Lê configuração de automação de faturamento / vencimento.
 * Chaves em falta usam os defaults (não exige linhas na BD).
 */
const GetSystemBillingSettingsService = async (): Promise<SystemBillingSettings> => {
  const keys = Object.values(BILLING_AUTOMATION_KEYS);
  const rows = await SystemSetting.findAll({
    where: { key: { [Op.in]: keys } }
  });
  const map = new Map(rows.map((r) => [r.key, r.value ?? ""]));

  const senderRaw = parseInt(
    String(map.get(BILLING_AUTOMATION_KEYS.whatsappSenderCompanyId) ?? ""),
    10
  );

  const before = parseInt(
    String(map.get(BILLING_AUTOMATION_KEYS.daysBeforeDueWarning) ?? ""),
    10
  );
  const afterWarn = parseInt(
    String(map.get(BILLING_AUTOMATION_KEYS.daysAfterDueWarning) ?? ""),
    10
  );
  const afterBlock = parseInt(
    String(map.get(BILLING_AUTOMATION_KEYS.daysAfterDueBlock) ?? ""),
    10
  );

  return {
    daysBeforeDueWarning: clampInt(
      Number.isNaN(before) ? DEFAULTS.daysBeforeDueWarning : before,
      0,
      365
    ),
    daysAfterDueWarning: clampInt(
      Number.isNaN(afterWarn) ? DEFAULTS.daysAfterDueWarning : afterWarn,
      0,
      365
    ),
    daysAfterDueBlock: clampInt(
      Number.isNaN(afterBlock) ? DEFAULTS.daysAfterDueBlock : afterBlock,
      0,
      3650
    ),
    enableAutoBlock:
      map.get(BILLING_AUTOMATION_KEYS.enableAutoBlock) === undefined ||
      map.get(BILLING_AUTOMATION_KEYS.enableAutoBlock) === ""
        ? DEFAULTS.enableAutoBlock
        : map.get(BILLING_AUTOMATION_KEYS.enableAutoBlock) === "true",
    enableAutoWarning:
      map.get(BILLING_AUTOMATION_KEYS.enableAutoWarning) === undefined ||
      map.get(BILLING_AUTOMATION_KEYS.enableAutoWarning) === ""
        ? DEFAULTS.enableAutoWarning
        : map.get(BILLING_AUTOMATION_KEYS.enableAutoWarning) === "true",
    enableAutoWhatsAppWarning:
      map.get(BILLING_AUTOMATION_KEYS.enableAutoWhatsAppWarning) === "true",
    whatsappSenderCompanyId: clampInt(
      Number.isNaN(senderRaw) ? DEFAULTS.whatsappSenderCompanyId : senderRaw,
      1,
      999_999
    )
  };
};

export default GetSystemBillingSettingsService;
