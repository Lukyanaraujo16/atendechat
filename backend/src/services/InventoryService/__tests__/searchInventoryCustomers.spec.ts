import { Op } from "sequelize";
import AppError from "../../../errors/AppError";
import Contact from "../../../models/Contact";
import SearchInventoryCustomersService, {
  parseInventoryCustomerSearchLimit
} from "../SearchInventoryCustomersService";
import { buildInventorySaleIncludes } from "../inventorySaleHelpers";

describe("SearchInventoryCustomersService", () => {
  const findAll = jest.spyOn(Contact, "findAll");

  beforeEach(() => {
    findAll.mockReset();
    findAll.mockResolvedValue([] as never);
  });

  afterAll(() => {
    findAll.mockRestore();
  });

  it("termo vazio lista no máximo 20 da empresa", async () => {
    await expect(
      SearchInventoryCustomersService({ companyId: 4, search: "   " })
    ).resolves.toEqual([]);
    expect(findAll).toHaveBeenCalledTimes(1);
    const options = findAll.mock.calls[0][0] as {
      where: any;
      limit: number;
      order: unknown;
    };
    expect(options.where).toEqual({ companyId: 4 });
    expect(options.limit).toBe(20);
    expect(options.order).toEqual([
      ["name", "ASC"],
      ["id", "ASC"]
    ]);
  });

  it("busca nome e telefone na empresa da sessão, com limite padrão 20", async () => {
    findAll.mockResolvedValue([
      {
        id: 7,
        name: "João da Silva",
        number: "27999999999",
        email: "segredo@x.com"
      }
    ] as never);

    const rows = await SearchInventoryCustomersService({
      companyId: 4,
      search: "  João  "
    });

    expect(rows).toEqual([
      { id: 7, name: "João da Silva", number: "27999999999" }
    ]);
    const options = findAll.mock.calls[0][0] as {
      where: any;
      attributes: string[];
      limit: number;
    };
    expect(options.where.companyId).toBe(4);
    const folded = JSON.stringify(options.where[Op.or][0]);
    expect(folded).toContain("utf8mb4_unicode_ci");
    expect(options.where[Op.or][0].logic[Op.like]).toBe("%João%");
    expect(options.where[Op.or][1]).toEqual({
      number: { [Op.like]: "%João%" }
    });
    expect(options.attributes).toEqual(["id", "name", "number"]);
    expect(options.limit).toBe(20);
    expect(rows[0]).not.toHaveProperty("email");
  });

  it("busca por telefone usa o mesmo filtro e o limite informado", async () => {
    await SearchInventoryCustomersService({
      companyId: 8,
      search: "9999",
      limit: "10"
    });
    const options = findAll.mock.calls[0][0] as { where: any; limit: number };
    expect(options.where.companyId).toBe(8);
    const folded = JSON.stringify(options.where[Op.or][0]);
    expect(folded).toContain("utf8mb4_unicode_ci");
    expect(options.where[Op.or][0].logic[Op.like]).toBe("%9999%");
    expect(options.where[Op.or][1]).toEqual({
      number: { [Op.like]: "%9999%" }
    });
    expect(options.limit).toBe(10);
  });

  it("rejeita limite inválido sem consultar contatos", async () => {
    await expect(
      SearchInventoryCustomersService({
        companyId: 4,
        search: "ana",
        limit: "0"
      })
    ).rejects.toMatchObject({
      message: "ERR_VALIDATION_ERROR",
      statusCode: 400
    });
    expect(findAll).not.toHaveBeenCalled();
    expect(() => parseInventoryCustomerSearchLimit("1.5")).toThrow(AppError);
    expect(() => parseInventoryCustomerSearchLimit(-1)).toThrow(AppError);
    expect(() => parseInventoryCustomerSearchLimit("abc")).toThrow(AppError);
    expect(() => parseInventoryCustomerSearchLimit(["20"])).toThrow(AppError);
    expect(() => parseInventoryCustomerSearchLimit({ limit: 20 })).toThrow(
      AppError
    );
    expect(parseInventoryCustomerSearchLimit(undefined)).toBe(20);
    expect(parseInventoryCustomerSearchLimit("")).toBe(20);
  });

  it("o contato já salvo da venda continua disponível por id, nome e telefone", () => {
    const contact = buildInventorySaleIncludes(4).find(
      include => include.model === Contact
    );
    expect(contact).toMatchObject({
      attributes: ["id", "name", "number"],
      required: false
    });
  });

  it("joao e JOAO pedem comparação insensível no nome e o telefone continua literal", async () => {
    await SearchInventoryCustomersService({ companyId: 4, search: "joao" });
    const joao = JSON.stringify(
      (findAll.mock.calls[0][0] as { where: any }).where[Op.or][0]
    );
    expect(joao).toContain("utf8mb4_unicode_ci");
    expect(
      (findAll.mock.calls[0][0] as { where: any }).where[Op.or][0].logic[
        Op.like
      ]
    ).toBe("%joao%");

    findAll.mockClear();
    await SearchInventoryCustomersService({ companyId: 9, search: "JOAO" });
    const upper = findAll.mock.calls[0][0] as { where: any };
    expect(upper.where.companyId).toBe(9);
    expect(JSON.stringify(upper.where[Op.or][0])).toContain(
      "utf8mb4_unicode_ci"
    );
    expect(upper.where[Op.or][0].logic[Op.like]).toBe("%JOAO%");
    expect(upper.where[Op.or][1]).toEqual({
      number: { [Op.like]: "%JOAO%" }
    });
  });
});
