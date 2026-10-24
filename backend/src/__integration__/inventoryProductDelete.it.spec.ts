/**
 * Integração (Postgres real) — exclusão definitiva de produto do Estoque e Vendas, preservando o
 * histórico financeiro. Cenários montados pelos serviços reais (cadastro, movimentação, venda,
 * conclusão com pagamento, cancelamento); só a conta a receber é criada direto no modelo.
 */
import "express-async-errors";
import request from "supertest";
import { sign } from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import sequelize from "../database";
import authConfig from "../config/auth";
import InventoryProduct from "../models/InventoryProduct";
import InventoryProductVariant from "../models/InventoryProductVariant";
import InventoryReceivable from "../models/InventoryReceivable";
import InventorySale from "../models/InventorySale";
import InventorySaleItem from "../models/InventorySaleItem";
import InventoryStockMovement from "../models/InventoryStockMovement";
import PlanFeature from "../models/PlanFeature";
import UserFeaturePermission from "../models/UserFeaturePermission";
import inventoryRoutes from "../routes/inventoryRoutes";
import CreateInventoryProductService from "../services/InventoryService/CreateInventoryProductService";
import CreateInventoryStockMovementService from "../services/InventoryService/CreateInventoryStockMovementService";
import CreateInventorySaleService from "../services/InventoryService/CreateInventorySaleService";
import AddInventorySaleItemService from "../services/InventoryService/AddInventorySaleItemService";
import CompleteInventorySaleService from "../services/InventoryService/CompleteInventorySaleService";
import CancelInventorySaleService from "../services/InventoryService/CancelInventorySaleService";
import CreateInventoryCustomerService from "../services/InventoryService/CreateInventoryCustomerService";
import CreateInventoryProductAttributeService from "../services/InventoryService/CreateInventoryProductAttributeService";
import CreateInventoryProductAttributeOptionService from "../services/InventoryService/CreateInventoryProductAttributeOptionService";
import CreateInventoryProductVariantService from "../services/InventoryService/CreateInventoryProductVariantService";
import GetInventoryReportSummaryService from "../services/InventoryService/GetInventoryReportSummaryService";
import GetInventoryReportProductsService from "../services/InventoryService/GetInventoryReportProductsService";
import DeleteInventoryProductService from "../services/InventoryService/DeleteInventoryProductService";
import { INVENTORY_SALES_FEATURE_KEY } from "../config/inventorySalesFeature";
import { INVENTORY_SALES_MANAGE_PRODUCTS } from "../config/inventorySalesPermissions";
import { buildApp, tokenFor } from "./helpers/miniApp";
import { assertDisposableDatabase, catchError, createCompany, createUser, daysFromToday } from "./helpers/fixtures";

jest.mock("../libs/socket", () => ({ getIO: () => ({ to: () => ({ emit: () => undefined }), emit: () => undefined }) }));

let seq = 0;

describe("Exclusão definitiva de produto com histórico preservado (Postgres real)", () => {
  const app = buildApp([inventoryRoutes]);
  let company: any;
  let other: any;
  let admin: any;

  async function product(companyId: number, over: Record<string, unknown> = {}) {
    seq += 1;
    return CreateInventoryProductService({
      companyId,
      body: { name: `Produto IT ${seq}`, sku: `IT-${seq}-${Date.now()}`, salePrice: "10.00", costPrice: "4.00", trackStock: true, currentQuantity: 20, ...over }
    });
  }
  const move = (companyId: number, productId: number, type: string, quantity: number) =>
    CreateInventoryStockMovementService({ companyId, createdBy: admin.id, body: { productId, type, quantity, notes: "teste IT" } });
  async function draft(companyId: number, items: Array<[number, number]>) {
    const sale = await CreateInventorySaleService({ companyId, createdBy: admin.id, body: {} });
    for (const [productId, quantity] of items) {
      await AddInventorySaleItemService({ companyId, saleId: sale.id, body: { productId, quantity } } as any);
    }
    return sale;
  }
  async function completed(companyId: number, items: Array<[number, number]>) {
    const sale = await draft(companyId, items);
    await InventorySale.update({ paymentMethod: "pix" } as any, { where: { id: sale.id } });
    await CompleteInventorySaleService({ companyId, saleId: sale.id, completedBy: admin.id, sellerUserId: admin.id, registerAsPaid: true, canManagePayments: true });
    return sale;
  }
  const counts = async (productId: number) => ({
    product: await InventoryProduct.count({ where: { id: productId } }),
    variants: await InventoryProductVariant.count({ where: { productId } }),
    movements: await InventoryStockMovement.count({ where: { productId } }),
    saleItems: await InventorySaleItem.count({ where: { productId } })
  });
  /** Tudo o que compõe o histórico financeiro de uma venda, exceto o vínculo com o cadastro. */
  async function history(saleId: number) {
    const [sale] = await sequelize.query(
      `SELECT id, status, "saleNumber", "subtotalAmount", "discountAmount", "totalAmount", "paidAmount", "paymentStatus", "paymentMethod", "completedAt", "cancelledAt"
       FROM "InventorySales" WHERE id = :id`, { replacements: { id: saleId }, type: QueryTypes.SELECT });
    const items = await sequelize.query(
      `SELECT id, "productName", "productSku", "variantLabel", "variantSku", unit, "unitPrice", "costPrice", quantity, "discountAmount", "totalAmount", "trackStock"
       FROM "InventorySaleItems" WHERE "saleId" = :id ORDER BY id`, { replacements: { id: saleId }, type: QueryTypes.SELECT });
    const payments = await sequelize.query(
      `SELECT id, method, status, amount FROM "InventorySalePayments" WHERE "saleId" = :id ORDER BY id`, { replacements: { id: saleId }, type: QueryTypes.SELECT });
    const receivables = await sequelize.query(
      `SELECT id, status, "originalAmount", "openAmount" FROM "InventoryReceivables" WHERE "saleId" = :id ORDER BY id`, { replacements: { id: saleId }, type: QueryTypes.SELECT });
    return { sale, items, payments, receivables };
  }
  const reports = async (companyId: number) => ({
    summary: await GetInventoryReportSummaryService({ companyId }),
    products: (await GetInventoryReportProductsService({ companyId })).map(r => ({ ...r, productId: undefined })).sort((a, b) => a.productName.localeCompare(b.productName))
  });
  const orphans = () =>
    sequelize.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM "InventorySaleItems" i WHERE i."productId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "InventoryProducts" p WHERE p.id = i."productId"))
            + (SELECT COUNT(*) FROM "InventorySaleItems" i WHERE i."variantId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "InventoryProductVariants" v WHERE v.id = i."variantId"))
            + (SELECT COUNT(*) FROM "InventoryStockMovements" m WHERE NOT EXISTS (SELECT 1 FROM "InventoryProducts" p WHERE p.id = m."productId"))
            + (SELECT COUNT(*) FROM "InventoryProductVariants" v WHERE NOT EXISTS (SELECT 1 FROM "InventoryProducts" p WHERE p.id = v."productId"))
            + (SELECT COUNT(*) FROM "InventorySellableCodes" c WHERE NOT EXISTS (SELECT 1 FROM "InventoryProducts" p WHERE p.id = c."productId"))
            + (SELECT COUNT(*) FROM "InventorySaleItems" i WHERE NOT EXISTS (SELECT 1 FROM "InventorySales" s WHERE s.id = i."saleId")) AS n`,
      { type: QueryTypes.SELECT }
    );

  beforeAll(async () => {
    await assertDisposableDatabase();
    company = await createCompany({ dueDate: daysFromToday(30) });
    other = await createCompany({ dueDate: daysFromToday(30) });
    for (const c of [company, other]) {
      await PlanFeature.create({ planId: c.planId, featureKey: INVENTORY_SALES_FEATURE_KEY, enabled: true } as any);
    }
    admin = await createUser({ companyId: company.id, profile: "admin" });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("1. produto sem histórico (e inativo): excluído", async () => {
    const p = await product(company.id, { trackStock: false, currentQuantity: 0 });
    await p.update({ active: false });
    await DeleteInventoryProductService({ companyId: company.id, id: p.id });
    expect(await counts(p.id)).toEqual({ product: 0, variants: 0, movements: 0, saleItems: 0 });
  });

  it("2. produto com estoque e movimentações: produto e movimentações excluídos; outro produto intacto", async () => {
    const p = await product(company.id);
    const keep = await product(company.id);
    await move(company.id, p.id, "in", 5);
    await move(company.id, p.id, "out", 2);
    await move(company.id, keep.id, "in", 3);
    const r = await DeleteInventoryProductService({ companyId: company.id, id: p.id });
    expect(r.removedStockMovements).toBeGreaterThanOrEqual(2);
    expect(await counts(p.id)).toEqual({ product: 0, variants: 0, movements: 0, saleItems: 0 });
    expect((await counts(keep.id)).movements).toBeGreaterThanOrEqual(1);
  });

  it("3. produto com variantes: variantes, opções, códigos, movimentações e item de rascunho excluídos; catálogo de atributos preservado", async () => {
    const p = await product(company.id, { productKind: "variable", trackStock: true, currentQuantity: 0 });
    const attr = await CreateInventoryProductAttributeService({ companyId: company.id, body: { name: `Cor IT ${seq}` } });
    const opt = await CreateInventoryProductAttributeOptionService({ companyId: company.id, attributeId: attr.id, body: { value: "Azul" } });
    const variant = await CreateInventoryProductVariantService({
      companyId: company.id, productId: p.id, createdBy: admin.id,
      body: { optionIds: [{ attributeId: attr.id, optionId: opt.id }], salePrice: "12.00", trackStock: true, currentQuantity: 0 }
    });
    await CreateInventoryStockMovementService({ companyId: company.id, createdBy: admin.id, body: { productId: p.id, variantId: variant.id, type: "in", quantity: 4, notes: "teste IT" } });
    const sale = await CreateInventorySaleService({ companyId: company.id, createdBy: admin.id, body: {} });
    await AddInventorySaleItemService({ companyId: company.id, saleId: sale.id, body: { productId: p.id, variantId: variant.id, quantity: 1 } } as any);

    await DeleteInventoryProductService({ companyId: company.id, id: p.id });
    expect(await counts(p.id)).toEqual({ product: 0, variants: 0, movements: 0, saleItems: 0 });
    const [o] = await sequelize.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM "InventoryProductVariantOptions" WHERE "variantId" = :v) + (SELECT COUNT(*) FROM "InventorySellableCodes" WHERE "productId" = :p) AS n`,
      { replacements: { v: variant.id, p: p.id }, type: QueryTypes.SELECT }
    );
    expect(Number(o.n)).toBe(0);
    expect(await sequelize.query(`SELECT 1 FROM "InventoryProductAttributeOptions" WHERE id = :id`, { replacements: { id: opt.id }, type: QueryTypes.SELECT })).toHaveLength(1);
  });

  it("rascunhos: item removido com total recalculado; rascunho só com o produto excluído", async () => {
    const p = await product(company.id);
    const keep = await product(company.id, { salePrice: "7.50" });
    const solo = await draft(company.id, [[p.id, 2]]);
    const mixed = await draft(company.id, [[p.id, 2], [keep.id, 2]]);
    const r = await DeleteInventoryProductService({ companyId: company.id, id: p.id });
    expect(r).toMatchObject({ removedDraftItems: 2, removedDraftSales: 1 });
    expect(await InventorySale.count({ where: { id: solo.id } })).toBe(0);
    const { sale, items } = await history(mixed.id);
    expect((items as any[]).map(i => i.productName)).toEqual([keep.name]);
    expect(Number((sale as any).totalAmount)).toBeCloseTo(15, 2);
  });

  it("4, 7, 9, 10, 11. venda concluída paga só com o produto: venda, item, pagamento, totais e relatórios preservados; item desvinculado", async () => {
    const p = await product(company.id);
    const sale = await completed(company.id, [[p.id, 3]]);
    await move(company.id, p.id, "in", 2);
    const before = { history: await history(sale.id), reports: await reports(company.id) };
    expect(before.history.payments.length).toBeGreaterThan(0);
    expect(Number((before.history.sale as any).paidAmount)).toBeCloseTo(30, 2);

    const r = await DeleteInventoryProductService({ companyId: company.id, id: p.id });
    expect(r.detachedSaleItems).toBe(1);
    expect(await counts(p.id)).toEqual({ product: 0, variants: 0, movements: 0, saleItems: 0 });
    expect(await history(sale.id)).toEqual(before.history);
    expect(await reports(company.id)).toEqual(before.reports);
    const [item] = await InventorySaleItem.findAll({ where: { saleId: sale.id } });
    expect(item).toMatchObject({ productId: null, variantId: null, productName: p.name, productSku: p.sku });
  });

  it("5. venda concluída com outros produtos: só o item do produto é desvinculado; demais itens e vínculos intactos", async () => {
    const p = await product(company.id);
    const keep = await product(company.id);
    const sale = await completed(company.id, [[p.id, 1], [keep.id, 2]]);
    const before = await history(sale.id);
    await DeleteInventoryProductService({ companyId: company.id, id: p.id });
    expect(await history(sale.id)).toEqual(before);
    const items = await InventorySaleItem.findAll({ where: { saleId: sale.id }, order: [["id", "ASC"]] });
    expect(items.map(i => i.productId)).toEqual([null, keep.id]);
    const s = before.sale as any;
    const sumItems = (before.items as any[]).reduce((acc, i) => acc + Number(i.totalAmount), 0);
    expect(Number(s.totalAmount)).toBeCloseTo(sumItems, 2);
  });

  it("6. vendas canceladas: limpa sem registros é excluída; com outros produtos ou pagamento é preservada e desvinculada", async () => {
    const p = await product(company.id);
    const keep = await product(company.id);
    const clean = await draft(company.id, [[p.id, 1]]);
    await CancelInventorySaleService({ companyId: company.id, saleId: clean.id, cancelledBy: admin.id, cancelReason: "teste IT" });
    const mixed = await draft(company.id, [[p.id, 1], [keep.id, 1]]);
    await CancelInventorySaleService({ companyId: company.id, saleId: mixed.id, cancelledBy: admin.id, cancelReason: "teste IT" });
    const paid = await completed(company.id, [[p.id, 1]]);
    await CancelInventorySaleService({ companyId: company.id, saleId: paid.id, cancelledBy: admin.id, cancelReason: "teste IT" });
    const before = { mixed: await history(mixed.id), paid: await history(paid.id) };

    const r = await DeleteInventoryProductService({ companyId: company.id, id: p.id });
    expect(r.removedCancelledSales).toBe(1);
    expect(await InventorySale.count({ where: { id: clean.id } })).toBe(0);
    expect(await history(mixed.id)).toEqual(before.mixed);
    expect(await history(paid.id)).toEqual(before.paid);
    expect((await counts(p.id)).product).toBe(0);
  });

  it("8. venda concluída com conta a receber: conta preservada e intacta", async () => {
    const p = await product(company.id);
    const sale = await completed(company.id, [[p.id, 1]]);
    const customer = await CreateInventoryCustomerService({ companyId: company.id, body: { name: `Cliente IT ${seq}` } as any });
    await InventoryReceivable.create({ companyId: company.id, customerId: (customer as any).id, saleId: sale.id, originType: "store_credit", originalAmount: 10, openAmount: 10, status: "open" } as any);
    const before = await history(sale.id);
    expect(before.receivables).toHaveLength(1);
    await DeleteInventoryProductService({ companyId: company.id, id: p.id });
    expect(await history(sale.id)).toEqual(before);
  });

  it("venda concluída e depois cancelada com produto excluído: cancelamento segue funcionando sem estoque a devolver", async () => {
    const p = await product(company.id);
    const keep = await product(company.id);
    const sale = await completed(company.id, [[p.id, 1], [keep.id, 1]]);
    const keepQty = Number((await keep.reload()).currentQuantity);
    await DeleteInventoryProductService({ companyId: company.id, id: p.id });
    await CancelInventorySaleService({ companyId: company.id, saleId: sale.id, cancelledBy: admin.id, cancelReason: "teste IT" });
    expect((await InventorySale.findByPk(sale.id))!.status).toBe("cancelled");
    expect(Number((await keep.reload()).currentQuantity)).toBe(keepQty + 1);
    expect(await InventoryStockMovement.count({ where: { productId: p.id } })).toBe(0);
  });

  it("17. rollback: falha no meio desfaz tudo (vínculos, rascunho, movimentações e produto)", async () => {
    const p = await product(company.id);
    const keep = await product(company.id);
    await move(company.id, p.id, "in", 2);
    const done = await completed(company.id, [[p.id, 1]]);
    const sale = await draft(company.id, [[p.id, 1], [keep.id, 1]]);
    const before = { counts: await counts(p.id), draft: await history(sale.id), done: await history(done.id) };
    const spy = jest.spyOn(InventoryProductVariant, "destroy").mockRejectedValueOnce(new Error("falha simulada"));
    const err = await catchError(DeleteInventoryProductService({ companyId: company.id, id: p.id }));
    spy.mockRestore();
    expect(err.message).toBe("falha simulada");
    expect(await counts(p.id)).toEqual(before.counts);
    expect(await history(sale.id)).toEqual(before.draft);
    expect(await history(done.id)).toEqual(before.done);
    expect((await InventorySaleItem.findOne({ where: { saleId: done.id } }))!.productId).toBe(p.id);
  });

  it("16. isolamento: produto de outra empresa ou inexistente → 404 e nada muda", async () => {
    const foreign = await product(other.id);
    const err = await catchError(DeleteInventoryProductService({ companyId: company.id, id: foreign.id }));
    expect(err.message).toBe("ERR_INVENTORY_PRODUCT_NOT_FOUND");
    expect((await counts(foreign.id)).product).toBe(1);
    expect((await catchError(DeleteInventoryProductService({ companyId: company.id, id: 999999999 }))).message).toBe("ERR_INVENTORY_PRODUCT_NOT_FOUND");
  });

  describe("12–15. permissões na rota", () => {
    const del = (token: string, id: number) =>
      request(app).delete(`/inventory/products/${id}`).set("Authorization", `Bearer ${token}`);

    it("12 e 13. atendente e supervisor com manageProducts não excluem (403); produto intacto", async () => {
      const p = await product(company.id);
      const attendant = await createUser({ companyId: company.id, profile: "user" });
      const supervisor = await createUser({ companyId: company.id, profile: "supervisor" });
      // manageProducts explícito: ainda assim não basta para a exclusão definitiva.
      for (const u of [attendant, supervisor]) {
        await UserFeaturePermission.create({ companyId: company.id, userId: u.id, featureKey: INVENTORY_SALES_MANAGE_PRODUCTS, enabled: true } as any);
        const res = await del(tokenFor(u), p.id);
        expect(res.status).toBe(403);
        expect(res.body.error).toBe("ERR_NO_PERMISSION");
      }
      expect((await counts(p.id)).product).toBe(1);
    });

    it("14. admin da empresa exclui (204), inclusive produto com venda concluída (histórico preservado)", async () => {
      const p = await product(company.id);
      const sale = await completed(company.id, [[p.id, 1]]);
      const before = await history(sale.id);
      expect((await del(tokenFor(admin), p.id)).status).toBe(204);
      expect((await counts(p.id)).product).toBe(0);
      expect(await history(sale.id)).toEqual(before);
    });

    it("15. Super Admin em modo suporte exclui (204); admin de outra empresa recebe 404; sem token 401", async () => {
      const p = await product(company.id);
      const superUser = await createUser({ companyId: null as any, superUser: true });
      const supportToken = sign(
        { id: String(superUser.id), username: "it", profile: "admin", companyId: company.id, supportMode: true, supportHomeCompanyId: null },
        authConfig.secret,
        { expiresIn: "15m" }
      );
      const outsider = await createUser({ companyId: other.id, profile: "admin" });
      expect((await del(tokenFor(outsider), p.id)).status).toBe(404);
      expect((await request(app).delete(`/inventory/products/${p.id}`)).status).toBe(401);
      expect((await counts(p.id)).product).toBe(1);
      expect((await del(supportToken, p.id)).status).toBe(204);
      expect((await counts(p.id)).product).toBe(0);
    });
  });

  it("nenhum registro órfão ao final (itens desvinculados não contam como órfãos)", async () => {
    const [o] = await orphans();
    expect(Number(o.n)).toBe(0);
    expect(await InventorySaleItem.count({ where: { productId: null } })).toBeGreaterThan(0);
  });
});
