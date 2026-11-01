/**
 * Integração (Postgres real) — o cliente comercial selecionado fica vinculado à venda em todo o ciclo:
 * rascunho, edição, finalização, consulta posterior e listagem; com isolamento entre empresas.
 */
import "express-async-errors";
import InventorySale from "../models/InventorySale";
import CreateInventoryProductService from "../services/InventoryService/CreateInventoryProductService";
import CreateInventorySaleService from "../services/InventoryService/CreateInventorySaleService";
import UpdateInventorySaleService from "../services/InventoryService/UpdateInventorySaleService";
import AddInventorySaleItemService from "../services/InventoryService/AddInventorySaleItemService";
import CompleteInventorySaleService from "../services/InventoryService/CompleteInventorySaleService";
import ShowInventorySaleService from "../services/InventoryService/ShowInventorySaleService";
import ListInventorySalesService from "../services/InventoryService/ListInventorySalesService";
import CreateInventoryCustomerService from "../services/InventoryService/CreateInventoryCustomerService";
import {
  assertDisposableDatabase,
  catchError,
  createCompany,
  createUser
} from "./helpers/fixtures";

jest.mock("../libs/socket", () => ({
  getIO: () => ({
    to: () => ({ emit: () => undefined }),
    emit: () => undefined
  })
}));

let seq = 0;

describe("Venda com cliente comercial (Postgres real)", () => {
  let company: any;
  let other: any;
  let admin: any;
  let customer: any;
  let foreignCustomer: any;

  beforeAll(async () => {
    await assertDisposableDatabase();
    company = await createCompany();
    other = await createCompany();
    admin = await createUser({ companyId: company.id, profile: "admin" });
    customer = await CreateInventoryCustomerService({
      companyId: company.id,
      body: {
        name: "Cliente Balcão IT",
        document: "12900985730",
        phone: "27988887777"
      }
    } as any);
    foreignCustomer = await CreateInventoryCustomerService({
      companyId: other.id,
      body: { name: "Cliente Outra" }
    } as any);
  });

  async function completedWith(customerId: number | null) {
    seq += 1;
    const product = await CreateInventoryProductService({
      companyId: company.id,
      body: {
        name: `Prod Cli ${seq}`,
        sku: `CLI-${seq}-${Date.now()}`,
        salePrice: "10.00",
        trackStock: true,
        currentQuantity: 10
      }
    } as any);
    const sale = await CreateInventorySaleService({
      companyId: company.id,
      createdBy: admin.id,
      body: { customerId }
    });
    await AddInventorySaleItemService({
      companyId: company.id,
      saleId: sale.id,
      body: { productId: product.id, quantity: 1 }
    } as any);
    await InventorySale.update({ paymentMethod: "pix" } as any, {
      where: { id: sale.id }
    });
    await CompleteInventorySaleService({
      companyId: company.id,
      saleId: sale.id,
      completedBy: admin.id,
      sellerUserId: admin.id,
      registerAsPaid: true,
      canManagePayments: true
    });
    return sale;
  }

  it("rascunho com cliente: vínculo e dados do cliente no retorno", async () => {
    const sale = await CreateInventorySaleService({
      companyId: company.id,
      createdBy: admin.id,
      body: { customerId: customer.id }
    });
    expect(sale.customerId).toBe(customer.id);
    expect(sale.contactId).toBeNull();
    expect((sale as any).customer?.name).toBe("Cliente Balcão IT");
  });

  it("finalização preserva o cliente; consulta e listagem posteriores trazem o cliente", async () => {
    const sale = await completedWith(customer.id);
    const shown: any = await ShowInventorySaleService({
      companyId: company.id,
      id: sale.id
    });
    expect(shown.status).toBe("completed");
    expect(shown.customerId).toBe(customer.id);
    expect(shown.customer).toMatchObject({
      id: customer.id,
      name: "Cliente Balcão IT",
      document: "12900985730",
      phone: "27988887777"
    });

    const list: any = await ListInventorySalesService({
      companyId: company.id,
      customerId: customer.id
    } as any);
    const rows = list.sales || list.rows || list;
    const row = rows.find((r: any) => r.id === sale.id);
    expect(row?.customer?.name).toBe("Cliente Balcão IT");
  });

  it("venda sem cliente continua permitida", async () => {
    const sale = await completedWith(null);
    const shown: any = await ShowInventorySaleService({
      companyId: company.id,
      id: sale.id
    });
    expect(shown.status).toBe("completed");
    expect(shown.customerId).toBeNull();
    expect(shown.customer).toBeNull();
  });

  it("edição do rascunho troca, mantém e remove o cliente", async () => {
    const sale = await CreateInventorySaleService({
      companyId: company.id,
      createdBy: admin.id,
      body: {}
    });
    let updated: any = await UpdateInventorySaleService({
      companyId: company.id,
      id: sale.id,
      body: { customerId: customer.id }
    });
    expect(updated.customerId).toBe(customer.id);
    // Atualizar outro campo não perde o vínculo.
    updated = await UpdateInventorySaleService({
      companyId: company.id,
      id: sale.id,
      body: { notes: "obs" }
    });
    expect(updated.customerId).toBe(customer.id);
    updated = await UpdateInventorySaleService({
      companyId: company.id,
      id: sale.id,
      body: { customerId: null }
    });
    expect(updated.customerId).toBeNull();
  });

  it("isolamento: cliente de outra empresa é rejeitado (criação e edição)", async () => {
    const e1 = await catchError(
      CreateInventorySaleService({
        companyId: company.id,
        createdBy: admin.id,
        body: { customerId: foreignCustomer.id }
      })
    );
    expect(e1?.statusCode).toBe(404);
    expect(e1?.message).toBe("ERR_INVENTORY_CUSTOMER_NOT_FOUND");
    const sale = await CreateInventorySaleService({
      companyId: company.id,
      createdBy: admin.id,
      body: {}
    });
    const e2 = await catchError(
      UpdateInventorySaleService({
        companyId: company.id,
        id: sale.id,
        body: { customerId: foreignCustomer.id }
      })
    );
    expect(e2?.statusCode).toBe(404);
    expect((await InventorySale.findByPk(sale.id))?.customerId).toBeNull();
  });

  it("cliente inexistente → 404; IDs inválidos → 400", async () => {
    const missing = await catchError(
      CreateInventorySaleService({
        companyId: company.id,
        createdBy: admin.id,
        body: { customerId: 999999999 }
      })
    );
    expect(missing?.statusCode).toBe(404);
    // eslint-disable-next-line no-restricted-syntax
    for (const bad of ["abc", 1.5, 0, -3]) {
      // eslint-disable-next-line no-await-in-loop
      const err = await catchError(
        CreateInventorySaleService({
          companyId: company.id,
          createdBy: admin.id,
          body: { customerId: bad }
        })
      );
      expect(err?.statusCode).toBe(400);
    }
  });
});
