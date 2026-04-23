import SystemSetting from "../../models/SystemSetting";
import { BRANDING_KEYS, PublicBranding } from "./GetPublicBrandingService";

const UpsertBrandingService = async (data: Partial<PublicBranding>): Promise<void> => {
  const entries: [string, string][] = [];
  if (data.systemName !== undefined) {
    entries.push([BRANDING_KEYS.systemName, String(data.systemName).trim()]);
  }
  if (data.loginLogoUrl !== undefined) {
    entries.push([BRANDING_KEYS.loginLogoUrl, String(data.loginLogoUrl).trim()]);
  }
  if (data.loginLogoDarkUrl !== undefined) {
    entries.push([BRANDING_KEYS.loginLogoDarkUrl, String(data.loginLogoDarkUrl).trim()]);
  }
  if (data.menuLogoUrl !== undefined) {
    entries.push([BRANDING_KEYS.menuLogoUrl, String(data.menuLogoUrl).trim()]);
  }
  if (data.menuLogoDarkUrl !== undefined) {
    entries.push([BRANDING_KEYS.menuLogoDarkUrl, String(data.menuLogoDarkUrl).trim()]);
  }
  if (data.faviconUrl !== undefined) {
    entries.push([BRANDING_KEYS.faviconUrl, String(data.faviconUrl).trim()]);
  }
  if (data.publicWhatsAppNumber !== undefined) {
    entries.push([
      BRANDING_KEYS.publicWhatsAppNumber,
      String(data.publicWhatsAppNumber).replace(/\D/g, "")
    ]);
  }
  if (data.publicWhatsAppMessage !== undefined) {
    entries.push([BRANDING_KEYS.publicWhatsAppMessage, String(data.publicWhatsAppMessage).trim()]);
  }

  for (const [key, value] of entries) {
    const existing = await SystemSetting.findOne({ where: { key } });
    if (existing) {
      await existing.update({ value });
    } else {
      await SystemSetting.create({ key, value });
    }
  }
};

export default UpsertBrandingService;
