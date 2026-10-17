/**
 * Cadastro da empresa (Fase 8.4) via UpdateCompanyService / CreateCompanyService:
 * normalização, validação só quando preenchido e compatibilidade com empresas antigas.
 */
const mockCompany: any = {};

function resetCompany() {
  for (const k of Object.keys(mockCompany)) delete mockCompany[k];
  Object.assign(mockCompany, {
    id: 5,
    name: "Empresa Antiga",
    phone: "1234",
    email: "legado@local",
    status: true,
    planId: 2,
    dueDate: "2026-11-10",
    recurrence: "MENSAL",
    modulePermissions: { crm: false },
    document: null,
    documentType: null
  });
  mockCompany.update = jest.fn(async function (this: any, patch: any) {
    Object.assign(this, patch);
    return this;
  });
}

jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn(async (id: any) => (Number(id) === 5 ? mockCompany : null)),
    findOne: jest.fn(async () => null),
    create: jest.fn(async (data: any) => ({ id: 77, ...data }))
  }
}));

jest.mock("../../../models/Setting", () => ({
  __esModule: true,
  default: {
    findOrCreate: jest.fn(async () => [{ update: jest.fn() }, true])
  }
}));

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: (fn: any) => fn({}) }
}));

jest.mock("../../CrmService/BootstrapCrmForCompanyService", () => ({
  __esModule: true,
  default: jest.fn(async () => undefined)
}));

jest.mock("../../CompanyService/provisionPrimaryAdminForCompany", () => ({
  __esModule: true,
  default: jest.fn(async () => ({
    userId: 1,
    email: "a@b.com",
    name: "A",
    mustChangePassword: false
  }))
}));

import UpdateCompanyService from "../../CompanyService/UpdateCompanyService";
import CreateCompanyService from "../../CompanyService/CreateCompanyService";
import Company from "../../../models/Company";

describe("UpdateCompanyService — cadastro", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCompany();
  });

  it("normaliza e grava os novos campos", async () => {
    await UpdateCompanyService({
      id: 5,
      tradeName: " Loja ",
      legalName: "Loja LTDA",
      document: "11.222.333/0001-81",
      documentType: "cpf",
      addressZipCode: "01310-100",
      addressStreet: "Av. Paulista",
      addressNumber: "1000",
      addressComplement: "",
      addressNeighborhood: "Bela Vista",
      addressCity: "São Paulo",
      addressState: "sp",
      phone: "(11) 98765-4321",
      email: "Contato@Loja.com"
    });
    expect(mockCompany.update).toHaveBeenCalledTimes(1);
    const patch = mockCompany.update.mock.calls[0][0];
    expect(patch).toEqual({
      tradeName: "Loja",
      legalName: "Loja LTDA",
      document: "11222333000181",
      documentType: "cnpj",
      addressZipCode: "01310100",
      addressStreet: "Av. Paulista",
      addressNumber: "1000",
      addressComplement: null,
      addressNeighborhood: "Bela Vista",
      addressCity: "São Paulo",
      addressState: "SP",
      phone: "11987654321",
      email: "contato@loja.com"
    });
  });

  it("empresa antiga com telefone/e-mail legados continua editável", async () => {
    await UpdateCompanyService({
      id: 5,
      name: "Empresa Antiga",
      phone: "1234",
      email: "legado@local",
      document: "",
      addressZipCode: "",
      addressState: ""
    });
    const patch = mockCompany.update.mock.calls[0][0];
    expect(patch).toEqual({
      name: "Empresa Antiga",
      document: null,
      documentType: null,
      addressZipCode: null,
      addressState: null
    });
  });

  it("não altera plano/recorrência/vencimento/módulos quando ausentes", async () => {
    await UpdateCompanyService({ id: 5, tradeName: "X" });
    const patch = mockCompany.update.mock.calls[0][0];
    expect(patch).toEqual({ tradeName: "X" });
    expect(mockCompany.dueDate).toBe("2026-11-10");
    expect(mockCompany.planId).toBe(2);
    expect(mockCompany.modulePermissions).toEqual({ crm: false });
  });

  it("continua aceitando campos existentes", async () => {
    await UpdateCompanyService({
      id: 5,
      planId: 3,
      recurrence: "ANUAL",
      dueDate: "2027-01-01",
      modulePermissions: { crm: true }
    });
    const patch = mockCompany.update.mock.calls[0][0];
    expect(patch).toEqual({
      planId: 3,
      recurrence: "ANUAL",
      dueDate: "2027-01-01",
      modulePermissions: { crm: true }
    });
  });

  it.each([
    [{ document: "11222333000180" }, "ERR_INVALID_DOCUMENT"],
    [{ addressZipCode: "1234" }, "ERR_INVALID_ZIPCODE"],
    [{ addressState: "XX" }, "ERR_INVALID_STATE"],
    [{ phone: "999" }, "ERR_INVALID_PHONE"],
    [{ email: "nao-e-email" }, "ERR_INVALID_EMAIL"]
  ])("rejeita %j com %s sem gravar", async (input, code) => {
    await expect(UpdateCompanyService({ id: 5, ...(input as any) })).rejects.toMatchObject({
      message: code,
      statusCode: 400
    });
    expect(mockCompany.update).not.toHaveBeenCalled();
  });

  it("empresa inexistente → 404", async () => {
    await expect(UpdateCompanyService({ id: 999, tradeName: "X" })).rejects.toMatchObject({
      message: "ERR_NO_COMPANY_FOUND",
      statusCode: 404
    });
  });
});

describe("CreateCompanyService — cadastro", () => {
  beforeEach(() => jest.clearAllMocks());

  it("grava campos cadastrais normalizados na criação", async () => {
    await CreateCompanyService({
      name: "Nova Empresa",
      email: "nova@empresa.com",
      document: "529.982.247-25",
      addressState: "rj",
      addressZipCode: ""
    });
    const data = (Company.create as jest.Mock).mock.calls[0][0];
    expect(data).toMatchObject({
      name: "Nova Empresa",
      document: "52998224725",
      documentType: "cpf",
      addressState: "RJ",
      addressZipCode: null
    });
  });

  it("documento inválido impede a criação", async () => {
    await expect(
      CreateCompanyService({ name: "Nova Empresa", email: "n@e.com", document: "123" })
    ).rejects.toMatchObject({ message: "ERR_INVALID_DOCUMENT" });
    expect(Company.create).not.toHaveBeenCalled();
  });
});
