import {
  BR_UFS,
  isValidBrPhone,
  isValidCep,
  isValidCnpj,
  isValidCompanyPhone,
  isValidCpf,
  isValidEmail,
  isValidUf,
  normalizeCompanyRegistrationInput,
  normalizeDigits
} from "../brDocuments";

describe("brDocuments", () => {
  it("normalizeDigits remove tudo que não é dígito", () => {
    expect(normalizeDigits("123.456.789-09")).toBe("12345678909");
    expect(normalizeDigits(null)).toBe("");
    expect(normalizeDigits(undefined)).toBe("");
    expect(normalizeDigits(12345)).toBe("12345");
  });

  it("isValidCpf valida dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("00000000000")).toBe(false);
    expect(isValidCpf("1234567890")).toBe(false);
  });

  it("isValidCnpj valida dígitos verificadores", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("22222222222222")).toBe(false);
    expect(isValidCnpj("1122233300018")).toBe(false);
  });

  it("isValidEmail", () => {
    expect(isValidEmail("contato@empresa.com.br")).toBe(true);
    expect(isValidEmail(" a.b@c.io ")).toBe(true);
    expect(isValidEmail("sem-arroba.com")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });

  it("isValidBrPhone exige 10–11 dígitos e DDD 11–99", () => {
    expect(isValidBrPhone("(11) 98765-4321")).toBe(true);
    expect(isValidBrPhone("1133334444")).toBe(true);
    expect(isValidBrPhone("0998765432")).toBe(false);
    expect(isValidBrPhone("10987654321")).toBe(false);
    expect(isValidBrPhone("987654321")).toBe(false);
    expect(isValidBrPhone("551198765432")).toBe(false);
  });

  it("isValidCompanyPhone aceita DDI 55 opcional", () => {
    expect(isValidCompanyPhone("5511987654321")).toBe(true);
    expect(isValidCompanyPhone("551133334444")).toBe(true);
    expect(isValidCompanyPhone("11987654321")).toBe(true);
    expect(isValidCompanyPhone("5501987654321")).toBe(false);
  });

  it("isValidCep", () => {
    expect(isValidCep("01310-100")).toBe(true);
    expect(isValidCep("0131010")).toBe(false);
    expect(isValidCep("00000000")).toBe(false);
  });

  it("UFs", () => {
    expect(BR_UFS).toHaveLength(27);
    expect(isValidUf("sp")).toBe(true);
    expect(isValidUf(" DF ")).toBe(true);
    expect(isValidUf("XX")).toBe(false);
    expect(isValidUf(null)).toBe(false);
  });
});

describe("normalizeCompanyRegistrationInput", () => {
  const expectAppError = (fn: () => unknown, code: string) => {
    try {
      fn();
    } catch (err: any) {
      expect(err.message).toBe(code);
      expect(err.statusCode).toBe(400);
      expect(typeof err.clientMessage).toBe("string");
      expect(err.clientMessage.length).toBeGreaterThan(5);
      return;
    }
    throw new Error(`esperava erro ${code}`);
  };

  it("normaliza documento, CEP e UF e deriva documentType", () => {
    const out = normalizeCompanyRegistrationInput({
      document: "11.222.333/0001-81",
      documentType: "cpf",
      addressZipCode: "01310-100",
      addressState: "sp",
      tradeName: "  Loja   Exemplo ",
      addressNumber: "100A"
    });
    expect(out).toEqual({
      document: "11222333000181",
      documentType: "cnpj",
      addressZipCode: "01310100",
      addressState: "SP",
      tradeName: "Loja Exemplo",
      addressNumber: "100A"
    });
  });

  it("CPF deriva documentType cpf", () => {
    const out = normalizeCompanyRegistrationInput({ document: "529.982.247-25" });
    expect(out).toEqual({ document: "52998224725", documentType: "cpf" });
  });

  it("string vazia vira null (empresa antiga continua editável)", () => {
    const out = normalizeCompanyRegistrationInput({
      document: "",
      addressZipCode: "",
      addressState: "  ",
      legalName: "",
      addressCity: null
    });
    expect(out).toEqual({
      document: null,
      documentType: null,
      addressZipCode: null,
      addressState: null,
      legalName: null,
      addressCity: null
    });
  });

  it("só processa chaves presentes", () => {
    expect(normalizeCompanyRegistrationInput({ name: "X" })).toEqual({});
    expect(
      normalizeCompanyRegistrationInput({ phone: "abc", email: "x" })
    ).toEqual({});
  });

  it("rejeita valores inválidos com códigos do contrato", () => {
    expectAppError(
      () => normalizeCompanyRegistrationInput({ document: "11222333000180" }),
      "ERR_INVALID_DOCUMENT"
    );
    expectAppError(
      () => normalizeCompanyRegistrationInput({ document: "123" }),
      "ERR_INVALID_DOCUMENT"
    );
    expectAppError(
      () => normalizeCompanyRegistrationInput({ addressZipCode: "123" }),
      "ERR_INVALID_ZIPCODE"
    );
    expectAppError(
      () => normalizeCompanyRegistrationInput({ addressState: "ZZ" }),
      "ERR_INVALID_STATE"
    );
    expectAppError(
      () =>
        normalizeCompanyRegistrationInput(
          { phone: "123" },
          { includeContact: true }
        ),
      "ERR_INVALID_PHONE"
    );
    expectAppError(
      () =>
        normalizeCompanyRegistrationInput(
          { email: "invalido" },
          { includeContact: true }
        ),
      "ERR_INVALID_EMAIL"
    );
    expectAppError(
      () =>
        normalizeCompanyRegistrationInput({ addressNumber: "1".repeat(21) }),
      "ERR_INVALID_FIELD"
    );
  });

  it("normaliza telefone/e-mail de contato quando includeContact", () => {
    const out = normalizeCompanyRegistrationInput(
      { phone: "(11) 98765-4321", email: " Contato@Empresa.COM " },
      { includeContact: true }
    );
    expect(out).toEqual({ phone: "11987654321", email: "contato@empresa.com" });
    expect(
      normalizeCompanyRegistrationInput(
        { phone: "", email: "" },
        { includeContact: true }
      )
    ).toEqual({ phone: null, email: null });
  });

  it("telefone/e-mail legados inalterados não bloqueiam a edição", () => {
    const out = normalizeCompanyRegistrationInput(
      { phone: "12-34", email: "legado@local", tradeName: "Novo" },
      { includeContact: true, current: { phone: "1234", email: "LEGADO@local" } }
    );
    expect(out).toEqual({ tradeName: "Novo" });
  });

  it("telefone legado alterado para outro inválido é rejeitado", () => {
    expectAppError(
      () =>
        normalizeCompanyRegistrationInput(
          { phone: "999" },
          { includeContact: true, current: { phone: "1234" } }
        ),
      "ERR_INVALID_PHONE"
    );
  });
});
