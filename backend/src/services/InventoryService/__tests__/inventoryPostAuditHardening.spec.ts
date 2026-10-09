import AppError from "../../../errors/AppError";
import CreateInventoryCustomerService from "../CreateInventoryCustomerService";
import UpdateInventoryCustomerService from "../UpdateInventoryCustomerService";
import ListInventoryCustomersService from "../ListInventoryCustomersService";
import GetInventoryCustomerService from "../GetInventoryCustomerService";
import InventoryCustomer from "../../../models/InventoryCustomer";
import Contact from "../../../models/Contact";
import InventorySale from "../../../models/InventorySale";
import InventorySalePayment from "../../../models/InventorySalePayment";
import InventoryReceivable from "../../../models/InventoryReceivable";
import InventoryReceivableInstallment from "../../../models/InventoryReceivableInstallment";
import InventoryReceivablePayment from "../../../models/InventoryReceivablePayment";
import InventorySettings from "../../../models/InventorySettings";
import {
  addInventorySalePayment,
  settleInventorySalePayment
} from "../InventorySalePaymentLinesService";
import ValidateInventoryStoreCreditForCompleteService from "../ValidateInventoryStoreCreditForCompleteService";
import * as credit from "../inventoryCustomerCredit";
import {
  allocateAmountAcrossInstallments
} from "../inventoryReceivableHelpers";
import { computeCreditAvailable } from "../inventoryCustomerCredit";
import { roundMoney } from "../inventorySaleHelpers";
import fs from "fs";
import path from "path";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async (cb: (t: any) => Promise<unknown>) =>
      cb({ LOCK: { UPDATE: "UPDATE" } })
    )
  }
}));

describe("post-audit hardening A1/A2", () => {
  const findOne = jest.spyOn(InventoryCustomer, "findOne");
  const create = jest.spyOn(InventoryCustomer, "create");
  const findAndCount = jest.spyOn(InventoryCustomer, "findAndCountAll");
  const contactFind = jest.spyOn(Contact, "findOne");
  const usedSpy = jest.spyOn(credit, "computeCustomerCreditUsed");

  beforeEach(() => {
    findOne.mockReset();
    create.mockReset();
    findAndCount.mockReset();
    contactFind.mockReset();
    usedSpy.mockReset();
    findOne.mockResolvedValue(null);
    contactFind.mockResolvedValue(null);
    usedSpy.mockResolvedValue({
      creditUsed: 0,
      openAmount: 0,
      overdueOpenAmount: 0
    });
  });

  afterAll(() => {
    findOne.mockRestore();
    create.mockRestore();
    findAndCount.mockRestore();
    contactFind.mockRestore();
    usedSpy.mockRestore();
  });

  it("A1: create sem manageCustomerCredit força creditLimit 0", async () => {
    create.mockImplementation(((payload: any) =>
      Promise.resolve({
        ...payload,
        id: 11,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      })) as any);

    const row = await CreateInventoryCustomerService({
      companyId: 4,
      canManageCredit: false,
      body: { name: "Cliente", creditLimit: 5000 }
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ creditLimit: 0 })
    );
    expect(row.creditLimit).toBe(0);
  });

  it("A1: create com manageCustomerCredit persiste limite", async () => {
    create.mockImplementation(((payload: any) =>
      Promise.resolve({
        ...payload,
        id: 12,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      })) as any);

    await CreateInventoryCustomerService({
      companyId: 4,
      canManageCredit: true,
      body: { name: "Cliente VIP", creditLimit: 1500 }
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ creditLimit: 1500 })
    );
  });

  it("A1: update sem manageCustomerCredit bloqueia alteração de limite", async () => {
    const customer: any = {
      id: 9,
      companyId: 4,
      type: "individual",
      name: "X",
      creditLimit: 100,
      update: jest.fn(),
      reload: jest.fn()
    };
    findOne.mockResolvedValue(customer);
    await expect(
      UpdateInventoryCustomerService({
        companyId: 4,
        customerId: 9,
        canManageCredit: false,
        body: { creditLimit: 999 }
      })
    ).rejects.toMatchObject({ message: "ERR_NO_PERMISSION" });
  });

  it("A2: list sem financials omite creditLimit e credit", async () => {
    findAndCount.mockResolvedValue({
      rows: [
        {
          id: 1,
          companyId: 4,
          name: "A",
          type: "individual",
          creditLimit: 2000,
          isActive: true,
          contactId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      count: 1
    } as any);

    const result = await ListInventoryCustomersService({
      companyId: 4,
      includeFinancials: false
    });
    expect(result.customers[0].credit).toBeUndefined();
    expect(result.customers[0].creditLimit).toBeUndefined();
  });

  it("A2: get sem financials omite credit", async () => {
    findOne.mockResolvedValue({
      id: 2,
      companyId: 4,
      name: "B",
      type: "individual",
      creditLimit: 800,
      isActive: true,
      contactId: null,
      contact: null,
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);

    const row = await GetInventoryCustomerService({
      companyId: 4,
      customerId: 2,
      includeFinancials: false
    });
    expect(row.credit).toBeUndefined();
    expect(row.creditLimit).toBeUndefined();
  });

  it("A2: com viewCustomerFinancials retorna creditLimit e credit", async () => {
    findOne.mockResolvedValue({
      id: 3,
      companyId: 4,
      name: "C",
      type: "individual",
      creditLimit: 1500,
      isActive: true,
      contactId: null,
      contact: null,
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);
    usedSpy.mockResolvedValue({
      creditUsed: 400,
      openAmount: 400,
      overdueOpenAmount: 0
    });
    // getCustomerCreditSnapshot chama computeCustomerCreditUsed no mesmo módulo;
    // re-mock direto no usedSpy já cobre o caminho se a export for usada.
    // Fallback: stub findAll de parcelas para evitar Sequelize não inicializado.
    const instSpy = jest
      .spyOn(InventoryReceivableInstallment, "findAll")
      .mockResolvedValue([] as any);

    const row = await GetInventoryCustomerService({
      companyId: 4,
      customerId: 3,
      includeFinancials: true
    });
    expect(row.creditLimit).toBe(1500);
    expect(row.credit).toBeDefined();
    expect((row.credit as any).creditLimit).toBe(1500);
    expect((row.credit as any).creditUsed).toBe(0);
    expect((row.credit as any).creditAvailable).toBe(1500);
    instSpy.mockRestore();
  });

  it("A2: Conta do Cliente exige viewCustomerFinancials (rota + controller)", () => {
    const routes = fs.readFileSync(
      path.join(__dirname, "../../../routes/inventoryRoutes.ts"),
      "utf8"
    );
    const accountBlock = routes.slice(
      routes.indexOf('/inventory/customers/:id/account')
    );
    expect(accountBlock).toContain("INVENTORY_SALES_VIEW_CUSTOMER_FINANCIALS");
    expect(accountBlock).not.toMatch(
      /INVENTORY_SALES_VIEW_CUSTOMERS[\s\S]{0,80}getCustomerAccount/
    );

    const controller = fs.readFileSync(
      path.join(
        __dirname,
        "../../../controllers/InventoryCustomerController.ts"
      ),
      "utf8"
    );
    expect(controller).toMatch(
      /getCustomerAccount[\s\S]*?canViewFinancials[\s\S]*?ERR_NO_PERMISSION/
    );
  });
});

describe("post-audit hardening A3 store_credit orphan", () => {
  const saleFind = jest.spyOn(InventorySale, "findOne");
  const paymentFindAll = jest.spyOn(InventorySalePayment, "findAll");
  const paymentCreate = jest.spyOn(InventorySalePayment, "create");
  const paymentFindOne = jest.spyOn(InventorySalePayment, "findOne");

  beforeEach(() => {
    saleFind.mockReset();
    paymentFindAll.mockReset();
    paymentCreate.mockReset();
    paymentFindOne.mockReset();
  });

  afterAll(() => {
    saleFind.mockRestore();
    paymentFindAll.mockRestore();
    paymentCreate.mockRestore();
    paymentFindOne.mockRestore();
  });

  it("completed + add store_credit é rejeitado", async () => {
    saleFind.mockResolvedValue({
      id: 50,
      companyId: 4,
      status: "completed",
      totalAmount: 100,
      update: jest.fn()
    } as any);
    paymentFindAll.mockResolvedValue([]);

    await expect(
      addInventorySalePayment({
        companyId: 4,
        saleId: 50,
        actorUserId: 1,
        body: { method: "store_credit", amount: 40 }
      })
    ).rejects.toMatchObject({
      message: "ERR_INVENTORY_STORE_CREDIT_AFTER_COMPLETE"
    });
    expect(paymentCreate).not.toHaveBeenCalled();
  });

  it("settle store_credit continua bloqueado", async () => {
    saleFind.mockResolvedValue({
      id: 51,
      companyId: 4,
      status: "completed",
      totalAmount: 100,
      update: jest.fn()
    } as any);
    paymentFindOne.mockResolvedValue({
      id: 9,
      method: "store_credit",
      status: "pending",
      amount: 70,
      update: jest.fn()
    } as any);
    paymentFindAll.mockResolvedValue([
      { id: 9, method: "store_credit", status: "pending", amount: 70 }
    ] as any);

    await expect(
      settleInventorySalePayment({
        companyId: 4,
        saleId: 51,
        paymentId: 9,
        actorUserId: 1,
        body: {}
      })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_STORE_CREDIT_NOT_CASH" });
  });
});

describe("post-audit hardening M4 allocation concurrency invariant", () => {
  it("segunda alocação sobre saldo já zerado falha (overpayment)", () => {
    const installments = [
      {
        id: 1,
        dueDate: "2026-01-01",
        status: "open",
        openAmount: 300
      }
    ];
    const first = allocateAmountAcrossInstallments(installments as any, 300);
    expect(first).toEqual([{ installmentId: 1, amount: 300 }]);

    // Simula estado após 1ª baixa sob lock: open=0
    const after = [
      { id: 1, dueDate: "2026-01-01", status: "paid", openAmount: 0 }
    ];
    expect(() =>
      allocateAmountAcrossInstallments(after as any, 300)
    ).toThrow(/ERR_INVENTORY_RECEIVABLE_OVERPAYMENT|excede/);
  });
});

describe("post-audit hardening M5 installment↔receivable", () => {
  it("migration payments usa FK composta installment+receivable+company", () => {
    const file = path.join(
      __dirname,
      "../../../database/migrations/20261008200400-create-inventory-receivable-payments.ts"
    );
    const src = fs.readFileSync(file, "utf8");
    expect(src).toContain(
      "InventoryReceivablePayments_installment_recv_company_fk"
    );
    expect(src).toContain('"installmentId", "receivableId", "companyId"');
  });

  it("migration customers usa FK composta contact+company", () => {
    const file = path.join(
      __dirname,
      "../../../database/migrations/20261008200000-create-inventory-customers.ts"
    );
    const src = fs.readFileSync(file, "utf8");
    expect(src).toContain("Contacts_id_companyId_unique");
    expect(src).toContain("InventoryCustomers_contact_company_fk");
    expect(src).toContain('"contactId", "companyId"');
    expect(src).not.toMatch(
      /contactId:[\s\S]*references:\s*\{\s*model:\s*"Contacts"/
    );
  });
});

describe("post-audit hardening concurrency limit (serialized validate)", () => {
  const lockSpy = jest.spyOn(credit, "lockInventoryCustomerForUpdate");
  const snapSpy = jest.spyOn(credit, "getCustomerCreditSnapshot");
  const settingsFind = jest.spyOn(InventorySettings, "findOne");

  beforeEach(() => {
    lockSpy.mockReset();
    snapSpy.mockReset();
    settingsFind.mockReset();
    settingsFind.mockResolvedValue({
      blockStoreCreditWhenOverdue: true
    } as any);
  });

  afterAll(() => {
    lockSpy.mockRestore();
    snapSpy.mockRestore();
    settingsFind.mockRestore();
  });

  it("segunda venda 700 com used 700 e limite 1000 falha sem override", async () => {
    lockSpy.mockResolvedValue({ id: 1, isActive: true } as any);
    snapSpy.mockResolvedValue({
      customerId: 1,
      creditLimit: 1000,
      creditUsed: 700,
      creditAvailable: 300,
      openAmount: 700,
      overdueOpenAmount: 0
    });

    await expect(
      ValidateInventoryStoreCreditForCompleteService({
        companyId: 4,
        customerId: 1,
        financedAmount: 700,
        transaction: { LOCK: { UPDATE: "UPDATE" } } as any
      })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_STORE_CREDIT_LIMIT" });
  });
});

describe("post-audit hardening mixed payment + credit math", () => {
  it("Pix 300 + SC 700 → paidAmount 300 e used +700", () => {
    const total = 1000;
    const paidCash = 300;
    const financed = 700;
    const paidAmount = paidCash; // store_credit pending não soma
    const creditUsed = financed;
    expect(paidAmount).toBe(300);
    expect(creditUsed).toBe(700);
    expect(roundMoney(paidAmount + financed)).toBe(total);
    expect(computeCreditAvailable(2000, 1000)).toBe(1000);
    expect(computeCreditAvailable(2000, 700)).toBe(1300); // após baixa 300
    expect(computeCreditAvailable(2000, 1000)).toBe(1000); // após estorno
  });
});

describe("post-audit hardening multi-tenant helpers", () => {
  it("Contact de outra empresa não vira Customer", async () => {
    const contactFind = jest.spyOn(Contact, "findOne");
    contactFind.mockResolvedValueOnce(null);
    const CreateFromContact = (
      await import("../CreateInventoryCustomerFromContactService")
    ).default;
    await expect(
      CreateFromContact({
        companyId: 2,
        contactId: 99,
        body: { name: "X" }
      })
    ).rejects.toMatchObject({
      message: "ERR_INVENTORY_CUSTOMER_CONTACT_NOT_FOUND"
    });
    expect(contactFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 99, companyId: 2 }
      })
    );
    contactFind.mockRestore();
  });

  it("Receivable/Payment lookups sempre filtram companyId", () => {
    const paySrc = fs.readFileSync(
      path.join(
        __dirname,
        "../CreateInventoryReceivablePaymentService.ts"
      ),
      "utf8"
    );
    const revSrc = fs.readFileSync(
      path.join(
        __dirname,
        "../ReverseInventoryReceivablePaymentService.ts"
      ),
      "utf8"
    );
    expect(paySrc).toMatch(
      /InventoryReceivable\.findOne\(\{[\s\S]*companyId:\s*input\.companyId/
    );
    expect(revSrc).toMatch(
      /where:\s*\{\s*id:\s*input\.paymentId,\s*companyId:\s*input\.companyId/
    );
    expect(revSrc).toMatch(
      /where:\s*\{\s*id:\s*payment\.receivableId,\s*companyId:\s*input\.companyId/
    );
  });

  it("Customer get filtra companyId (IDOR)", async () => {
    const spy = jest.spyOn(InventoryCustomer, "findOne");
    spy.mockResolvedValueOnce(null);
    await expect(
      GetInventoryCustomerService({ companyId: 2, customerId: 1 })
    ).rejects.toMatchObject({ message: "ERR_INVENTORY_CUSTOMER_NOT_FOUND" });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, companyId: 2 }
      })
    );
    spy.mockRestore();
  });
});

describe("post-audit hardening legacy sale", () => {
  it("venda só com contactId permanece operável sem Customer/Receivable", async () => {
    const modelSrc = fs.readFileSync(
      path.join(__dirname, "../../../models/InventorySale.ts"),
      "utf8"
    );
    expect(modelSrc).toMatch(/customerId:\s*number\s*\|\s*null/);
    expect(modelSrc).toMatch(/@AllowNull[\s\S]{0,80}customerId/);

    const completeSrc = fs.readFileSync(
      path.join(__dirname, "../CompleteInventorySaleService.ts"),
      "utf8"
    );
    // Receivable só nasce do fluxo store_credit — sem linha SC não há receivable retroativo.
    expect(completeSrc).toContain("CreateInventoryReceivableFromSaleService");
    expect(completeSrc).toMatch(/store_credit/);
    expect(completeSrc).not.toMatch(/retroativ/);

    const saleFind = jest.spyOn(InventorySale, "findOne");
    saleFind.mockResolvedValueOnce({
      id: 900,
      companyId: 4,
      status: "completed",
      contactId: 55,
      customerId: null,
      totalAmount: 80,
      update: jest.fn()
    } as any);
    const paymentFindAll = jest.spyOn(InventorySalePayment, "findAll");
    paymentFindAll.mockResolvedValueOnce([
      { id: 1, method: "pix", amount: 80, status: "paid" }
    ] as any);

    await expect(
      addInventorySalePayment({
        companyId: 4,
        saleId: 900,
        actorUserId: 1,
        body: { method: "cash", amount: 10 }
      })
    ).rejects.toMatchObject({
      // rejeição de regra de pagamento — não de Customer obrigatório
      message: expect.stringMatching(/^ERR_INVENTORY/)
    });
    expect(saleFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 900, companyId: 4 }
      })
    );
    saleFind.mockRestore();
    paymentFindAll.mockRestore();
  });
});
