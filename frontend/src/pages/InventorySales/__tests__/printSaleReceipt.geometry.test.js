/**
 * @jest-environment jsdom
 */
import {
  SALE_RECEIPT_GEOMETRY_CONTRACT,
  getPrintProfile,
  THERMAL_CONTENT_PADDING,
} from "../printSaleReceipt";
import { SALE_RECEIPT_PRINT_FORMATS } from "../saleReceiptPrintFormats";

describe("geometria homologada do recibo", () => {
  it("A4 permanece portrait com size A4", () => {
    const profile = getPrintProfile(SALE_RECEIPT_PRINT_FORMATS.a4);
    expect(profile.css).toContain(
      `size: ${SALE_RECEIPT_GEOMETRY_CONTRACT.a4.pageSize}`
    );
    expect(profile.frameWidth).toBe("210mm");
  });

  it("80mm preserva largura e padding 0 3mm", () => {
    const profile = getPrintProfile(SALE_RECEIPT_PRINT_FORMATS.thermal80);
    const contract = SALE_RECEIPT_GEOMETRY_CONTRACT.thermal80;
    expect(profile.frameWidth).toBe(contract.paperWidth);
    expect(profile.css).toContain(`size: ${contract.paperWidth}`);
    expect(profile.css).toContain(
      `padding: ${contract.contentPadding} !important`
    );
    expect(THERMAL_CONTENT_PADDING).toBe("3mm");
    expect(profile.css).not.toMatch(/transform:\s*scale/);
    expect(profile.css).not.toMatch(/zoom:/);
  });

  it("58mm preserva largura e padding 0 3mm", () => {
    const profile = getPrintProfile(SALE_RECEIPT_PRINT_FORMATS.thermal58);
    const contract = SALE_RECEIPT_GEOMETRY_CONTRACT.thermal58;
    expect(profile.frameWidth).toBe(contract.paperWidth);
    expect(profile.css).toContain(`size: ${contract.paperWidth}`);
    expect(profile.css).toContain(
      `padding: ${contract.contentPadding} !important`
    );
    expect(profile.css).not.toMatch(/transform:\s*scale/);
    expect(profile.css).not.toMatch(/zoom:/);
  });
});
