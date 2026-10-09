import AppError from "../../../errors/AppError";
import Contact from "../../../models/Contact";
import InventoryCustomer from "../../../models/InventoryCustomer";
import CreateInventoryCustomerService from "../CreateInventoryCustomerService";
import CreateInventoryCustomerFromContactService from "../CreateInventoryCustomerFromContactService";
import {
  assertDocumentUniqueForCompany,
  parseCustomerFields
} from "../inventoryCustomerHelpers";

describe("InventoryCustomer services/helpers", () => {
  const findOne = jest.spyOn(InventoryCustomer, "findOne");
  const create = jest.spyOn(InventoryCustomer, "create");
  const contactFind = jest.spyOn(Contact, "findOne");

  beforeEach(() => {
    findOne.mockReset();
    create.mockReset();
    contactFind.mockReset();
  });

  afterAll(() => {
    findOne.mockRestore();
    create.mockRestore();
    contactFind.mockRestore();
  });

  it("cria Cliente PF e PJ", async () => {
    findOne.mockResolvedValue(null);
    create.mockImplementation(((payload: any) =>
      Promise.resolve({
        ...payload,
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      })) as any);

    const pf = await CreateInventoryCustomerService({
      companyId: 4,
      body: {
        type: "individual",
        name: "Maria",
        document: "52998224725",
        phone: "27988887777"
      }
    });
    expect(pf.type).toBe("individual");
    expect(pf.document).toBe("52998224725");

    const pj = await CreateInventoryCustomerService({
      companyId: 4,
      body: {
        type: "company",
        name: "Loja X",
        tradeName: "X",
        document: "11222333000181"
      }
    });
    expect(pj.type).toBe("company");
    expect(pj.tradeName).toBe("X");
  });

  it("Cliente sem Contact é permitido", () => {
    const fields = parseCustomerFields(
      { name: "Balcão", phone: "27999999999" },
      { requireName: true }
    );
    expect(fields.contactId).toBeUndefined();
    expect(fields.name).toBe("Balcão");
  });

  it("documento duplicado na mesma empresa é bloqueado", async () => {
    findOne.mockResolvedValue({ id: 99 } as any);
    await expect(
      assertDocumentUniqueForCompany({
        companyId: 4,
        document: "52998224725"
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("mesmo documento em empresas distintas é permitido (unicidade por companyId)", async () => {
    findOne.mockResolvedValue(null);
    await expect(
      assertDocumentUniqueForCompany({
        companyId: 5,
        document: "52998224725"
      })
    ).resolves.toBeUndefined();
    expect(findOne).toHaveBeenCalledWith({
      where: { companyId: 5, document: "52998224725" }
    });
  });

  it("cria Cliente a partir de Contact com prefill", async () => {
    contactFind.mockResolvedValue({
      id: 12,
      companyId: 4,
      name: "Contato WA",
      number: "27991112222",
      email: "a@b.com",
      postalCode: "29000000",
      street: "Rua A",
      addressNumber: "10",
      addressComplement: null,
      district: "Centro",
      city: "Vitória",
      state: "ES"
    } as any);
    findOne.mockResolvedValue(null);
    create.mockImplementation(((payload: any) =>
      Promise.resolve({
        ...payload,
        id: 33,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      })) as any);

    const customer = await CreateInventoryCustomerFromContactService({
      companyId: 4,
      contactId: 12
    });
    expect(customer.contactId).toBe(12);
    expect(customer.name).toBe("Contato WA");
    expect(customer.phone).toBe("27991112222");
  });
});
