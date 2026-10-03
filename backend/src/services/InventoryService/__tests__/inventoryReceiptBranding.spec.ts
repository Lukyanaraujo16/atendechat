import AppError from "../../../errors/AppError";
import InventorySettings from "../../../models/InventorySettings";
import GetInventoryReceiptBrandingService from "../GetInventoryReceiptBrandingService";
import GetOrCreateInventorySettingsService from "../GetOrCreateInventorySettingsService";
import UpdateInventorySettingsService from "../UpdateInventorySettingsService";

function settingsRow(overrides: Record<string, unknown> = {}) {
  const row = {
    id: 1,
    companyId: 4,
    defaultCommissionRate: 5,
    allowNegativeStock: true,
    saleNumberPrefix: "VD",
    nextSaleNumber: 9,
    receiptTradeName: null,
    receiptLegalName: null,
    receiptDocument: null,
    receiptPhone: null,
    receiptAddress: null,
    receiptFooterMessage: null,
    update: jest.fn(async function update(patch: Record<string, unknown>) {
      Object.assign(row, patch);
      return row;
    }),
    reload: jest.fn(async function reload() {
      return row;
    }),
    ...overrides
  };
  return row;
}

describe("InventorySettings branding do recibo", () => {
  const findOrCreate = jest.spyOn(InventorySettings, "findOrCreate");

  afterEach(() => {
    findOrCreate.mockReset();
  });

  afterAll(() => {
    findOrCreate.mockRestore();
  });

  it("GetOrCreate busca pela empresa da sessão e não inventa branding", async () => {
    const row = settingsRow();
    findOrCreate.mockResolvedValue([row, true] as never);

    const settings = await GetOrCreateInventorySettingsService(4);

    expect(findOrCreate).toHaveBeenCalledWith({
      where: { companyId: 4 },
      defaults: { companyId: 4 }
    });
    expect(settings.receiptTradeName).toBeNull();
    expect(settings.receiptFooterMessage).toBeNull();
    expect(settings.nextSaleNumber).toBe(9);
  });

  it("leitura do recibo devolve só os textos da empresa", async () => {
    const row = settingsRow({
      receiptTradeName: "Loja ABC",
      receiptPhone: "(27) 99999-9999"
    });
    findOrCreate.mockResolvedValue([row, false] as never);

    const branding = await GetInventoryReceiptBrandingService(4);

    expect(branding).toEqual({
      receiptTradeName: "Loja ABC",
      receiptLegalName: null,
      receiptDocument: null,
      receiptPhone: "(27) 99999-9999",
      receiptAddress: null,
      receiptFooterMessage: null,
      receiptLogoUrl: null
    });
    expect(branding).not.toHaveProperty("nextSaleNumber");
    expect(branding).not.toHaveProperty("companyId");
    expect(branding.receiptLogoUrl).toBeNull();
  });

  it("update faz trim, vazio vira null e preserva campos omitidos", async () => {
    const row = settingsRow();
    findOrCreate.mockResolvedValue([row, false] as never);

    await UpdateInventorySettingsService({
      companyId: 4,
      body: {
        companyId: 99,
        nextSaleNumber: 1,
        receiptTradeName: "   Loja ABC   ",
        receiptLegalName: "    ",
        receiptDocument: "",
        receiptPhone: " +55 27 99999-9999 ",
        receiptAddress: "Rua X, 123\nCentro",
        receiptFooterMessage: null
      }
    });

    expect(row.update).toHaveBeenCalledWith({
      receiptTradeName: "Loja ABC",
      receiptLegalName: null,
      receiptDocument: null,
      receiptPhone: "+55 27 99999-9999",
      receiptAddress: "Rua X, 123\nCentro",
      receiptFooterMessage: null
    });
    expect(row.companyId).toBe(4);
    expect(row.nextSaleNumber).toBe(9);
    expect(row.defaultCommissionRate).toBe(5);
    expect(row.allowNegativeStock).toBe(true);
    expect(row.saleNumberPrefix).toBe("VD");
  });

  it("update parcial de comissão não apaga o branding já gravado", async () => {
    const row = settingsRow({ receiptTradeName: "Loja ABC" });
    findOrCreate.mockResolvedValue([row, false] as never);

    await UpdateInventorySettingsService({
      companyId: 4,
      body: { defaultCommissionRate: 12 }
    });

    expect(row.update).toHaveBeenCalledWith({ defaultCommissionRate: 12 });
    expect(row.receiptTradeName).toBe("Loja ABC");
    expect(row.nextSaleNumber).toBe(9);
  });

  it("rejeita texto acima do limite", async () => {
    const row = settingsRow();
    findOrCreate.mockResolvedValue([row, false] as never);

    await expect(
      UpdateInventorySettingsService({
        companyId: 4,
        body: { receiptDocument: "1".repeat(33) }
      })
    ).rejects.toBeInstanceOf(AppError);
    expect(row.update).not.toHaveBeenCalled();
  });

  it("isola o tenant e rejeita valor que não é texto", async () => {
    const companyA = settingsRow({ companyId: 4 });
    const companyB = settingsRow({
      companyId: 8,
      receiptTradeName: "Outra loja"
    });
    const resolveCompany = (options: { where?: { companyId?: number } }) => {
      const companyId = options.where && options.where.companyId;
      const row = companyId === 8 ? companyB : companyA;
      return Promise.resolve([row, false]);
    };
    findOrCreate.mockImplementation(resolveCompany as never);

    await UpdateInventorySettingsService({
      companyId: 8,
      body: { companyId: 4, receiptPhone: "  (11) 98888-0000  " }
    });

    expect(companyB.update).toHaveBeenCalledWith({
      receiptPhone: "(11) 98888-0000"
    });
    expect(companyA.update).not.toHaveBeenCalled();
    expect(companyB.companyId).toBe(8);
    expect(companyB.receiptTradeName).toBe("Outra loja");

    await expect(
      UpdateInventorySettingsService({
        companyId: 4,
        body: { receiptAddress: { street: "Rua X" } }
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("ignora receiptLogoUrl enviado no JSON das configurações", async () => {
    const stored =
      "/public/inventory-receipts/company-4/11111111-1111-4111-8111-111111111111.png";
    const row = settingsRow({ receiptLogoUrl: stored });
    findOrCreate.mockResolvedValue([row, false] as never);

    await UpdateInventorySettingsService({
      companyId: 4,
      body: {
        receiptTradeName: "Loja",
        receiptLogoUrl: "https://evil.example/logo.png"
      } as never
    });

    expect(row.update).toHaveBeenCalledWith({ receiptTradeName: "Loja" });
    expect(row.receiptLogoUrl).toBe(stored);

    (row.update as jest.Mock).mockClear();
    await UpdateInventorySettingsService({
      companyId: 4,
      body: { receiptLogoUrl: "https://evil.example/logo.png" } as never
    });
    expect(row.update).not.toHaveBeenCalled();
    expect(row.receiptLogoUrl).toBe(stored);
  });
});
