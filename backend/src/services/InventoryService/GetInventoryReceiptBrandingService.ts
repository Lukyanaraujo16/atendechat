import GetOrCreateInventorySettingsService from "./GetOrCreateInventorySettingsService";
import { receiptLogoReference } from "./inventoryReceiptLogo";
import {
  ReceiptPrintFormat,
  receiptPrintFormatOrDefault
} from "./inventoryReceiptPrintFormat";

export type InventoryReceiptBranding = {
  receiptTradeName: string | null;
  receiptLegalName: string | null;
  receiptDocument: string | null;
  receiptPhone: string | null;
  receiptAddress: string | null;
  receiptFooterMessage: string | null;
  receiptLogoUrl: string | null;
  receiptPrintFormat: ReceiptPrintFormat;
};

export default async function GetInventoryReceiptBrandingService(
  companyId: number
): Promise<InventoryReceiptBranding> {
  const settings = await GetOrCreateInventorySettingsService(companyId);
  return {
    receiptTradeName: settings.receiptTradeName ?? null,
    receiptLegalName: settings.receiptLegalName ?? null,
    receiptDocument: settings.receiptDocument ?? null,
    receiptPhone: settings.receiptPhone ?? null,
    receiptAddress: settings.receiptAddress ?? null,
    receiptFooterMessage: settings.receiptFooterMessage ?? null,
    receiptLogoUrl: receiptLogoReference(settings),
    receiptPrintFormat: receiptPrintFormatOrDefault(settings.receiptPrintFormat)
  };
}
