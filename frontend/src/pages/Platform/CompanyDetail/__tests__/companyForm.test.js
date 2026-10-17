import {
  buildCompanyPayload,
  companyToFormValues,
} from "../../../../components/CompaniesManager/companyHelpers";
import { validateCompanyForm, diffChangedKeys } from "../companyFormValidation";
import { legacyCompanyRedirectTarget } from "../../PlatformCompanies";

const legacyCompany = {
  id: 7,
  name: "Empresa Antiga",
  email: "",
  phone: "5511912345678",
  planId: 2,
  status: true,
  dueDate: "2026-11-01T00:00:00.000Z",
  recurrence: "MENSAL",
  timezone: "America/Sao_Paulo",
  contractedPlanValue: null,
  storageLimitGb: null,
  modulePermissions: {},
  document: "123", // legado inválido
};

describe("companyToFormValues / buildCompanyPayload", () => {
  it("converte a empresa e não envia nada quando nada mudou", () => {
    const initial = companyToFormValues(legacyCompany);
    expect(initial.phone).toBe("+55 (11) 91234-5678");
    expect(initial.dueDate).toBe("2026-11-01");
    const built = buildCompanyPayload({ ...initial }, { initialValues: initial, isSuper: true });
    expect(built).toEqual({ ok: true, payload: {} });
  });

  it("envia só os campos alterados, normalizando documento e CEP", () => {
    const initial = companyToFormValues(legacyCompany);
    const values = {
      ...initial,
      document: "11.222.333/0001-81",
      addressZipCode: "01310-100",
      addressState: "sp",
      tradeName: "  ",
      contractedPlanValueStr: "199,90",
    };
    const built = buildCompanyPayload(values, { initialValues: initial, isSuper: true });
    expect(built.ok).toBe(true);
    expect(built.payload).toEqual({
      document: "11222333000181",
      documentType: "cnpj",
      addressZipCode: "01310100",
      addressState: "SP",
      contractedPlanValue: 199.9,
    });
  });

  it("não-super não envia valor contratado/armazenamento", () => {
    const initial = companyToFormValues(legacyCompany);
    const built = buildCompanyPayload(
      { ...initial, contractedPlanValueStr: "10", storageLimitGbStr: "5" },
      { initialValues: initial, isSuper: false }
    );
    expect(built.payload).toEqual({});
  });

  it("valor contratado inválido é recusado", () => {
    const initial = companyToFormValues(legacyCompany);
    const built = buildCompanyPayload(
      { ...initial, contractedPlanValueStr: "abc" },
      { initialValues: initial, isSuper: true }
    );
    expect(built.ok).toBe(false);
    expect(built.field).toBe("contractedPlanValueStr");
  });
});

describe("validateCompanyForm", () => {
  it("cadastro antigo incompleto/inválido continua salvável se os campos não mudaram", () => {
    const initial = companyToFormValues(legacyCompany);
    expect(validateCompanyForm({ ...initial, timezone: "America/Manaus" }, initial)).toEqual({});
  });
  it("valida campos alterados", () => {
    const initial = companyToFormValues(legacyCompany);
    const errors = validateCompanyForm(
      {
        ...initial,
        name: " ",
        document: "529.982.247-24",
        phone: "(01) 2345",
        addressZipCode: "0131",
        addressState: "XX",
        email: "x@",
      },
      initial
    );
    expect(Object.keys(errors).sort()).toEqual(
      ["addressState", "addressZipCode", "document", "email", "name", "phone"].sort()
    );
  });
  it("diffChangedKeys", () => {
    expect(diffChangedKeys({ a: 1, b: { c: 1 } }, { a: 1, b: { c: 2 } })).toEqual(["b"]);
  });
});

describe("legacyCompanyRedirectTarget", () => {
  it("redireciona links antigos", () => {
    expect(legacyCompanyRedirectTarget("?focus=12&section=finance")).toBe("/saas/companies/12/financeiro");
    expect(legacyCompanyRedirectTarget("?focus=12")).toBe("/saas/companies/12/cadastro");
    expect(legacyCompanyRedirectTarget("?focus=abc")).toBe(null);
    expect(legacyCompanyRedirectTarget("")).toBe(null);
  });
});
