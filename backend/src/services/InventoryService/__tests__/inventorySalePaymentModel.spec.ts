import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../../..");

describe("InventorySalePayment foundation contract", () => {
  it("model declara tableName e campos do contrato P1", () => {
    const src = fs.readFileSync(
      path.join(root, "models/InventorySalePayment.ts"),
      "utf8"
    );
    expect(src).toContain('tableName: "InventorySalePayments"');
    for (const field of [
      "companyId",
      "saleId",
      "method",
      "amount",
      "status",
      "paidAt",
      "notes",
      "cardInstallmentCount",
      "createdByUserId"
    ]) {
      expect(src).toContain(field);
    }
    expect(src).toContain('"pending" | "paid" | "reversed"');
  });

  it("InventorySale associa hasMany payments", () => {
    const src = fs.readFileSync(
      path.join(root, "models/InventorySale.ts"),
      "utf8"
    );
    expect(src).toContain("InventorySalePayment");
    expect(src).toContain("payments: InventorySalePayment[]");
    expect(src).toContain("@HasMany(() => InventorySalePayment");
  });

  it("migration cria tabela, FK composta CASCADE, checks e down só dropa payments", () => {
    const src = fs.readFileSync(
      path.join(
        root,
        "database/migrations/20261007180000-create-inventory-sale-payments-foundation.ts"
      ),
      "utf8"
    );
    expect(src).toContain('createTable(\n        "InventorySalePayments"');
    expect(src).toContain("InventorySalePayments_sale_company_fk");
    expect(src).toContain('ON DELETE CASCADE');
    expect(src).toContain("InventorySalePayments_amount_positive_chk");
    expect(src).toContain("InventorySalePayments_status_chk");
    expect(src).toContain("planInventorySalePaymentBackfill");
    expect(src).toContain("WHERE NOT EXISTS");
    expect(src).toContain('dropTable("InventorySalePayments")');
    expect(src).not.toContain('removeColumn("InventorySales"');
  });
});
