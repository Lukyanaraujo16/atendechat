export const EMPTY_RECEIPT_BRANDING = {
  tradeName: "",
  legalName: "",
  document: "",
  phone: "",
  address: "",
  footerMessage: "",
};

function asText(value) {
  if (value == null) return "";
  return String(value).trim();
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
  };
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
    a.footerMessage === b.footerMessage
  );
}
