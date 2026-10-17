import {
  maskCpf,
  maskCnpj,
  maskCpfCnpj,
  isValidCpf,
  isValidCnpj,
  validateDocument,
  maskPhone,
  isValidPhone,
  maskCep,
  isValidCep,
  isValidUf,
  isValidEmail,
  fetchViaCep,
} from "../brMasks";

describe("brMasks — CPF/CNPJ", () => {
  it("aplica máscaras", () => {
    expect(maskCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(maskCpfCnpj("529982247")).toBe("529.982.247");
    expect(maskCpfCnpj("112223330001")).toBe("11.222.333/0001");
  });
  it("valida dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });
  it("identifica o tipo do documento", () => {
    expect(validateDocument("529.982.247-25")).toEqual({ type: "cpf", valid: true, digits: "52998224725" });
    expect(validateDocument("11.222.333/0001-81").type).toBe("cnpj");
    expect(validateDocument("123").type).toBe(null);
  });
});

describe("brMasks — telefone, CEP, UF, e-mail", () => {
  it("máscara de telefone com DDD", () => {
    expect(maskPhone("11912345678")).toBe("(11) 91234-5678");
    expect(maskPhone("1123456789")).toBe("(11) 2345-6789");
    expect(maskPhone("5511912345678")).toBe("+55 (11) 91234-5678");
    expect(maskPhone("")).toBe("");
  });
  it("valida telefone", () => {
    expect(isValidPhone("(11) 91234-5678")).toBe(true);
    expect(isValidPhone("(11) 2345-6789")).toBe(true);
    expect(isValidPhone("+55 (11) 91234-5678")).toBe(true);
    expect(isValidPhone("(01) 2345-6789")).toBe(false);
    expect(isValidPhone("12345")).toBe(false);
  });
  it("CEP, UF e e-mail", () => {
    expect(maskCep("01310100")).toBe("01310-100");
    expect(isValidCep("01310-100")).toBe(true);
    expect(isValidCep("0131")).toBe(false);
    expect(isValidUf("sp")).toBe(true);
    expect(isValidUf("XX")).toBe(false);
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
  });
});

describe("fetchViaCep", () => {
  it("normaliza a resposta", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ logradouro: "Av. Paulista", bairro: "Bela Vista", localidade: "São Paulo", uf: "sp" }),
    });
    await expect(fetchViaCep("01310-100", { fetchImpl })).resolves.toEqual({
      street: "Av. Paulista",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
      complement: "",
    });
    expect(fetchImpl.mock.calls[0][0]).toBe("https://viacep.com.br/ws/01310100/json/");
  });
  it("CEP inexistente → NOT_FOUND", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ erro: true }) });
    await expect(fetchViaCep("99999999", { fetchImpl })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("CEP incompleto → INVALID_CEP sem requisição", async () => {
    const fetchImpl = jest.fn();
    await expect(fetchViaCep("123", { fetchImpl })).rejects.toMatchObject({ code: "INVALID_CEP" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("falha de rede → NETWORK", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(fetchViaCep("01310100", { fetchImpl })).rejects.toMatchObject({ code: "NETWORK" });
  });
  it("timeout → TIMEOUT", async () => {
    const fetchImpl = jest.fn(
      (url, { signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        })
    );
    await expect(fetchViaCep("01310100", { fetchImpl, timeoutMs: 10 })).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });
});
