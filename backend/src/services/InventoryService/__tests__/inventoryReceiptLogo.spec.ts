import fs from "fs";
import os from "os";
import path from "path";

import AppError from "../../../errors/AppError";
import InventorySettings from "../../../models/InventorySettings";
import GetInventoryReceiptBrandingService from "../GetInventoryReceiptBrandingService";
import {
  RECEIPT_LOGO_MAX_BYTES,
  confinedReceiptLogoFile,
  removeInventoryReceiptLogo,
  uploadInventoryReceiptLogo
} from "../inventoryReceiptLogo";

function pngBuffer(): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  return buffer;
}

function jpegBuffer(): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buffer);
  return buffer;
}

function webpBuffer(): Buffer {
  const buffer = Buffer.alloc(24);
  buffer.write("RIFF", 0, "ascii");
  buffer.write("WEBP", 8, "ascii");
  return buffer;
}

function settingsRow(companyId: number) {
  const row = {
    id: 1,
    companyId,
    receiptLogoUrl: null as string | null,
    update: jest.fn(async (patch: { receiptLogoUrl: string | null }) => {
      row.receiptLogoUrl = patch.receiptLogoUrl;
      return row;
    }),
    reload: jest.fn(async () => row)
  };
  return row;
}

describe("logo do recibo", () => {
  const findOrCreate = jest.spyOn(InventorySettings, "findOrCreate");
  let root = "";

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "receipt-logo-"));
    process.env.INVENTORY_RECEIPT_LOGO_ROOT = root;
    findOrCreate.mockReset();
  });

  afterEach(() => {
    delete process.env.INVENTORY_RECEIPT_LOGO_ROOT;
    fs.rmSync(root, { recursive: true, force: true });
  });

  afterAll(() => {
    findOrCreate.mockRestore();
  });

  function useCompany(companyId: number) {
    const row = settingsRow(companyId);
    findOrCreate.mockImplementation(((options: {
      where?: { companyId?: number };
    }) => {
      if (options.where && options.where.companyId === companyId) {
        return Promise.resolve([row, false]);
      }
      return Promise.resolve([
        settingsRow(options.where?.companyId || 0),
        false
      ]);
    }) as never);
    return row;
  }

  it("aceita PNG, JPEG e WEBP no diretório do tenant", async () => {
    const row = useCompany(4);
    const png = await uploadInventoryReceiptLogo({
      companyId: 4,
      buffer: pngBuffer(),
      mimetype: "image/png",
      originalName: "../../logo.png"
    });
    const jpeg = await uploadInventoryReceiptLogo({
      companyId: 4,
      buffer: jpegBuffer(),
      mimetype: "image/jpeg",
      originalName: "foto.jpeg"
    });
    expect(png.receiptLogoUrl).toMatch(
      /^\/public\/inventory-receipts\/company-4\/[0-9a-f-]+\.png$/
    );
    expect(png.receiptLogoUrl).not.toContain("..");
    expect(jpeg.receiptLogoUrl.endsWith(".jpg")).toBe(true);
    expect(row.receiptLogoUrl).toBe(jpeg.receiptLogoUrl);
    expect(
      fs.existsSync(confinedReceiptLogoFile(4, jpeg.receiptLogoUrl) || "")
    ).toBe(true);
    expect(
      fs.existsSync(confinedReceiptLogoFile(4, png.receiptLogoUrl) || "")
    ).toBe(false);
    expect(jpeg.receiptLogoUrl).not.toContain(root);

    const webpRow = useCompany(5);
    const webp = await uploadInventoryReceiptLogo({
      companyId: 5,
      buffer: webpBuffer(),
      mimetype: "image/webp",
      originalName: "marca.webp"
    });
    expect(webp.receiptLogoUrl).toContain("/company-5/");
    expect(webp.receiptLogoUrl.endsWith(".webp")).toBe(true);
    expect(webpRow.receiptLogoUrl).toBe(webp.receiptLogoUrl);
    expect(
      path.resolve(confinedReceiptLogoFile(5, webp.receiptLogoUrl) || "")
    ).toContain(`${path.sep}company-5${path.sep}`);
  });

  it("rejeita SVG, PDF, HTML renomeado e arquivo acima de 2 MB", async () => {
    useCompany(4);
    const cases = [
      {
        buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
        mimetype: "image/svg+xml",
        originalName: "logo.svg"
      },
      {
        buffer: Buffer.from("%PDF-1.4"),
        mimetype: "application/pdf",
        originalName: "logo.pdf"
      },
      {
        buffer: Buffer.from("<html><script>alert(1)</script></html>"),
        mimetype: "image/png",
        originalName: "logo.png"
      }
    ];
    await expect(
      uploadInventoryReceiptLogo({ companyId: 4, ...cases[0] })
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      uploadInventoryReceiptLogo({ companyId: 4, ...cases[1] })
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      uploadInventoryReceiptLogo({ companyId: 4, ...cases[2] })
    ).rejects.toBeInstanceOf(AppError);
    const huge = Buffer.alloc(RECEIPT_LOGO_MAX_BYTES + 1);
    pngBuffer().copy(huge);
    await expect(
      uploadInventoryReceiptLogo({
        companyId: 4,
        buffer: huge,
        mimetype: "image/png",
        originalName: "grande.png"
      })
    ).rejects.toBeInstanceOf(AppError);
    expect(fs.readdirSync(root)).toEqual([]);
  });

  it("não grava a logo de outra empresa e compensa falha no banco", async () => {
    const row = useCompany(4);
    const first = await uploadInventoryReceiptLogo({
      companyId: 4,
      buffer: pngBuffer(),
      mimetype: "image/png",
      originalName: "a.png"
    });
    const firstFile = confinedReceiptLogoFile(4, first.receiptLogoUrl);
    (row.update as jest.Mock).mockImplementationOnce(async () => {
      throw new Error("db-down");
    });
    await expect(
      uploadInventoryReceiptLogo({
        companyId: 4,
        buffer: jpegBuffer(),
        mimetype: "image/jpeg",
        originalName: "b.jpg"
      })
    ).rejects.toThrow("db-down");
    expect(row.receiptLogoUrl).toBe(first.receiptLogoUrl);
    expect(fs.existsSync(firstFile || "")).toBe(true);
    const files = fs.readdirSync(path.join(root, "company-4"));
    expect(files).toEqual([path.basename(firstFile || "")]);
    expect(fs.existsSync(path.join(root, "company-99"))).toBe(false);
  });

  it("remove a logo, tolera arquivo ausente e não apaga outro tenant", async () => {
    const row = useCompany(4);
    const uploaded = await uploadInventoryReceiptLogo({
      companyId: 4,
      buffer: pngBuffer(),
      mimetype: "image/png",
      originalName: "a.png"
    });
    const file = confinedReceiptLogoFile(4, uploaded.receiptLogoUrl) || "";
    const removed = await removeInventoryReceiptLogo(4);
    expect(removed).toEqual({ receiptLogoUrl: null });
    expect(row.receiptLogoUrl).toBeNull();
    expect(fs.existsSync(file)).toBe(false);
    await expect(removeInventoryReceiptLogo(4)).resolves.toEqual({
      receiptLogoUrl: null
    });

    const again = await uploadInventoryReceiptLogo({
      companyId: 4,
      buffer: pngBuffer(),
      mimetype: "image/png",
      originalName: "c.png"
    });
    const kept = confinedReceiptLogoFile(4, again.receiptLogoUrl) || "";
    fs.unlinkSync(kept);
    await expect(removeInventoryReceiptLogo(4)).resolves.toEqual({
      receiptLogoUrl: null
    });

    const foreign = await uploadInventoryReceiptLogo({
      companyId: 4,
      buffer: pngBuffer(),
      mimetype: "image/png",
      originalName: "d.png"
    });
    const foreignFile =
      confinedReceiptLogoFile(4, foreign.receiptLogoUrl) || "";
    const other = settingsRow(8);
    other.receiptLogoUrl = foreign.receiptLogoUrl;
    findOrCreate.mockImplementation(((options: {
      where?: { companyId?: number };
    }) => {
      const id = options.where?.companyId;
      return Promise.resolve([id === 8 ? other : row, false]);
    }) as never);
    await removeInventoryReceiptLogo(8);
    expect(other.receiptLogoUrl).toBeNull();
    expect(fs.existsSync(foreignFile)).toBe(true);
    expect(confinedReceiptLogoFile(8, foreign.receiptLogoUrl)).toBeNull();
    expect(
      confinedReceiptLogoFile(
        4,
        "/public/inventory-receipts/company-4/../../secret.png"
      )
    ).toBeNull();
  });

  it("a leitura do recibo devolve a URL pública e esconde path físico", async () => {
    const row = useCompany(4);
    const uploaded = await uploadInventoryReceiptLogo({
      companyId: 4,
      buffer: webpBuffer(),
      mimetype: "image/webp",
      originalName: "marca.webp"
    });
    row.receiptLogoUrl = uploaded.receiptLogoUrl;
    const branding = await GetInventoryReceiptBrandingService(4);
    expect(branding.receiptLogoUrl).toBe(uploaded.receiptLogoUrl);
    expect(branding.receiptLogoUrl).not.toContain(root);
    expect(branding).not.toHaveProperty("companyId");

    row.receiptLogoUrl = "https://evil.example/logo.png";
    const hidden = await GetInventoryReceiptBrandingService(4);
    expect(hidden.receiptLogoUrl).toBeNull();
  });
});
