import InventorySettings from "../../models/InventorySettings";

export default async function GetOrCreateInventorySettingsService(
  companyId: number
): Promise<InventorySettings> {
  const [settings] = await InventorySettings.findOrCreate({
    where: { companyId },
    defaults: { companyId }
  });
  return settings;
}
