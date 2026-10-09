import { Op } from "sequelize";
import AppError from "../../../errors/AppError";
import InventoryCustomer from "../../../models/InventoryCustomer";
import SearchInventoryCustomersService, {
  parseInventoryCustomerSearchLimit
} from "../SearchInventoryCustomersService";
import * as credit from "../inventoryCustomerCredit";

describe("SearchInventoryCustomersService", () => {
  const findAll = jest.spyOn(InventoryCustomer, "findAll");
  const usedSpy = jest.spyOn(credit, "computeCustomerCreditUsed");

  beforeEach(() => {
    findAll.mockReset();
    findAll.mockResolvedValue([] as never);
    usedSpy.mockResolvedValue({
      creditUsed: 0,
      openAmount: 0,
      overdueOpenAmount: 0
    });
  });

  afterAll(() => {
    findAll.mockRestore();
    usedSpy.mockRestore();
  });

  it("termo vazio lista no máximo 20 da empresa (ativos)", async () => {
    await expect(
      SearchInventoryCustomersService({ companyId: 4, search: "   " })
    ).resolves.toEqual([]);
    expect(findAll).toHaveBeenCalledTimes(1);
    const options = findAll.mock.calls[0][0] as {
      where: any;
      limit: number;
      order: unknown;
    };
    expect(options.where).toEqual({ companyId: 4, isActive: true });
    expect(options.limit).toBe(20);
    expect(options.order).toEqual([
      ["name", "ASC"],
      ["id", "ASC"]
    ]);
  });

  it("busca nome/documento/telefone na empresa da sessão", async () => {
    findAll.mockResolvedValue([
      {
        id: 7,
        name: "João da Silva",
        phone: "27999999999",
        document: "52998224725",
        type: "individual",
        creditLimit: 1000,
        isActive: true,
        postalCode: null,
        street: null,
        addressNumber: null,
        addressComplement: null,
        district: null,
        city: null,
        state: null,
        contactId: null
      }
    ] as never);
    usedSpy.mockResolvedValue({
      creditUsed: 200,
      openAmount: 200,
      overdueOpenAmount: 0
    });

    const rows = await SearchInventoryCustomersService({
      companyId: 4,
      search: "  João  "
    });

    expect(rows[0]).toMatchObject({
      id: 7,
      name: "João da Silva",
      number: "27999999999",
      creditUsed: 200,
      creditAvailable: 800
    });
    const options = findAll.mock.calls[0][0] as { where: any; limit: number };
    expect(options.where.companyId).toBe(4);
    expect(options.where[Op.or]).toBeDefined();
    expect(options.limit).toBe(20);
  });

  it("parseInventoryCustomerSearchLimit rejeita fora de 1..50", () => {
    expect(parseInventoryCustomerSearchLimit(undefined)).toBe(20);
    expect(parseInventoryCustomerSearchLimit("10")).toBe(10);
    expect(() => parseInventoryCustomerSearchLimit("0")).toThrow(AppError);
    expect(() => parseInventoryCustomerSearchLimit("51")).toThrow(AppError);
  });
});
