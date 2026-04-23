import { Op } from "sequelize";
import SystemSetting from "../../models/SystemSetting";

export const BRANDING_KEYS = {
  systemName: "systemName",
  loginLogoUrl: "loginLogoUrl",
  loginLogoDarkUrl: "loginLogoDarkUrl",
  menuLogoUrl: "menuLogoUrl",
  menuLogoDarkUrl: "menuLogoDarkUrl",
  faviconUrl: "faviconUrl",
  publicWhatsAppNumber: "publicWhatsAppNumber",
  publicWhatsAppMessage: "publicWhatsAppMessage"
} as const;

/** Valores quando ainda não há registo na BD (evitar “CoreFlow” como marca implícita). */
export const DEFAULT_BRANDING = {
  systemName: "",
  loginLogoUrl: "",
  loginLogoDarkUrl: "",
  menuLogoUrl: "",
  menuLogoDarkUrl: "",
  faviconUrl: "",
  publicWhatsAppNumber: "",
  publicWhatsAppMessage: ""
};

export type PublicBranding = {
  systemName: string;
  loginLogoUrl: string;
  /** Logo da página de login no tema escuro; vazio = usar `loginLogoUrl`. */
  loginLogoDarkUrl: string;
  menuLogoUrl: string;
  /** Logo do menu interno no tema escuro; vazio = usar `menuLogoUrl`. */
  menuLogoDarkUrl: string;
  faviconUrl: string;
  /** Digits only, international format (e.g. 5527999999999). */
  publicWhatsAppNumber: string;
  /** Optional prefilled message for wa.me link. */
  publicWhatsAppMessage: string;
};

const GetPublicBrandingService = async (): Promise<PublicBranding> => {
  const rows = await SystemSetting.findAll({
    where: {
      key: {
        [Op.in]: [
          BRANDING_KEYS.systemName,
          BRANDING_KEYS.loginLogoUrl,
          BRANDING_KEYS.loginLogoDarkUrl,
          BRANDING_KEYS.menuLogoUrl,
          BRANDING_KEYS.menuLogoDarkUrl,
          BRANDING_KEYS.faviconUrl,
          BRANDING_KEYS.publicWhatsAppNumber,
          BRANDING_KEYS.publicWhatsAppMessage
        ]
      }
    }
  });

  const map: Record<string, string> = {};
  rows.forEach((r) => {
    map[r.key] = r.value ?? "";
  });

  const hasKey = (k: string) => Object.prototype.hasOwnProperty.call(map, k);

  return {
    systemName: hasKey(BRANDING_KEYS.systemName)
      ? String(map[BRANDING_KEYS.systemName] ?? "")
      : DEFAULT_BRANDING.systemName,
    loginLogoUrl: hasKey(BRANDING_KEYS.loginLogoUrl)
      ? String(map[BRANDING_KEYS.loginLogoUrl] ?? "")
      : DEFAULT_BRANDING.loginLogoUrl,
    loginLogoDarkUrl: hasKey(BRANDING_KEYS.loginLogoDarkUrl)
      ? String(map[BRANDING_KEYS.loginLogoDarkUrl] ?? "")
      : DEFAULT_BRANDING.loginLogoDarkUrl,
    menuLogoUrl: hasKey(BRANDING_KEYS.menuLogoUrl)
      ? String(map[BRANDING_KEYS.menuLogoUrl] ?? "")
      : DEFAULT_BRANDING.menuLogoUrl,
    menuLogoDarkUrl: hasKey(BRANDING_KEYS.menuLogoDarkUrl)
      ? String(map[BRANDING_KEYS.menuLogoDarkUrl] ?? "")
      : DEFAULT_BRANDING.menuLogoDarkUrl,
    faviconUrl: hasKey(BRANDING_KEYS.faviconUrl)
      ? String(map[BRANDING_KEYS.faviconUrl] ?? "")
      : DEFAULT_BRANDING.faviconUrl,
    publicWhatsAppNumber: hasKey(BRANDING_KEYS.publicWhatsAppNumber)
      ? String(map[BRANDING_KEYS.publicWhatsAppNumber] ?? "")
      : DEFAULT_BRANDING.publicWhatsAppNumber,
    publicWhatsAppMessage: hasKey(BRANDING_KEYS.publicWhatsAppMessage)
      ? String(map[BRANDING_KEYS.publicWhatsAppMessage] ?? "")
      : DEFAULT_BRANDING.publicWhatsAppMessage
  };
};

export default GetPublicBrandingService;
