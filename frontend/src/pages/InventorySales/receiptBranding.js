import { getApiUrl } from "../../config/backendUrl";
import {
  DEFAULT_SALE_RECEIPT_PRINT_FORMAT,
  isSaleReceiptPrintFormat,
} from "./saleReceiptPrintFormats";

export const EMPTY_RECEIPT_BRANDING = {
  tradeName: "",
  legalName: "",
  document: "",
  phone: "",
  address: "",
  footerMessage: "",
  logoUrl: "",
};

function asText(value) {
  if (value == null) return "";
  return String(value).trim();
}

function asLogoUrl(value) {
  const text = asText(value);
  if (!text.startsWith("/public/inventory-receipts/company-")) return "";
  if (text.includes("..") || text.includes("\\") || text.includes("//")) return "";
  return getApiUrl(text);
}

export function receiptBrandingFromSettings(data) {
  const source = data || {};
  return {
    tradeName: asText(source.receiptTradeName),
    legalName: asText(source.receiptLegalName),
    document: asText(source.receiptDocument),
    phone: asText(source.receiptPhone),
    address: asText(source.receiptAddress),
    footerMessage: asText(source.receiptFooterMessage),
    logoUrl: asLogoUrl(source.receiptLogoUrl),
  };
}

export function receiptLogoDisplayUrl(stored) {
  return asLogoUrl(stored);
}

export function receiptPrintFormatFromPayload(data) {
  const value = data && data.receiptPrintFormat;
  if (isSaleReceiptPrintFormat(value)) return value;
  return DEFAULT_SALE_RECEIPT_PRINT_FORMAT;
}

export function hasReceiptBrandingHeader(branding) {
  if (!branding) return false;
  return Boolean(
    branding.tradeName ||
      branding.legalName ||
      branding.document ||
      branding.address ||
      branding.phone
  );
}

export function hasReceiptBrandingFooter(branding) {
  return Boolean(branding && branding.footerMessage);
}

export function sameReceiptBranding(left, right) {
  const a = left || EMPTY_RECEIPT_BRANDING;
  const b = right || EMPTY_RECEIPT_BRANDING;
  return (
    a.tradeName === b.tradeName &&
    a.legalName === b.legalName &&
    a.document === b.document &&
    a.phone === b.phone &&
    a.address === b.address &&
    a.footerMessage === b.footerMessage &&
    a.logoUrl === b.logoUrl
  );
}
