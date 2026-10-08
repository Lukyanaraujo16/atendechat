/**
 * @jest-environment node
 */
import {
  sanitizeCepDigits,
  formatCepDisplay,
  mapViaCepResponse,
  mergeCepLookupIntoAddress,
  fetchViaCep,
} from "../cepLookup";

describe("cepLookup helpers", () => {
  it("sanitiza e limita a 8 dígitos", () => {
    expect(sanitizeCepDigits("29100-000")).toBe("29100000");
    expect(sanitizeCepDigits(" 29100-000 ")).toBe("29100000");
    expect(sanitizeCepDigits("29100000")).toBe("29100000");
    expect(sanitizeCepDigits("29a100b000c99")).toBe("29100000");
    expect(sanitizeCepDigits("29100")).toBe("29100");
  });

  it("formata XXXXX-XXX", () => {
    expect(formatCepDisplay("29100000")).toBe("29100-000");
    expect(formatCepDisplay("29100-000")).toBe("29100-000");
    expect(formatCepDisplay("29100")).toBe("29100");
  });

  it("mapeia resposta ViaCEP e trata erro:true", () => {
    expect(
      mapViaCepResponse({
        cep: "29100-000",
        logradouro: "Rua Exemplo",
        complemento: "de 1 ao fim",
        bairro: "Centro",
        localidade: "Vila Velha",
        uf: "ES",
      })
    ).toEqual({
      postalCode: "29100-000",
      street: "Rua Exemplo",
      district: "Centro",
      city: "Vila Velha",
      state: "ES",
    });
    expect(mapViaCepResponse({ erro: true })).toBeNull();
    expect(mapViaCepResponse(null)).toBeNull();
  });

  it("merge não sobrescreve número/complemento nem apaga com vazio", () => {
    const current = {
      postalCode: "29100-000",
      street: "Rua Antiga",
      number: "123",
      complement: "Apto 201",
      district: "Velho",
      city: "Cidade",
      state: "RJ",
    };
    const merged = mergeCepLookupIntoAddress(current, {
      postalCode: "29100-000",
      street: "Rua Exemplo",
      district: "Centro",
      city: "Vila Velha",
      state: "ES",
    });
    expect(merged.number).toBe("123");
    expect(merged.complement).toBe("Apto 201");
    expect(merged.street).toBe("Rua Exemplo");
    expect(merged.state).toBe("ES");

    const keepStreet = mergeCepLookupIntoAddress(current, {
      postalCode: "29100-000",
      street: "",
      district: "Centro",
      city: "Vila Velha",
      state: "ES",
    });
    expect(keepStreet.street).toBe("Rua Antiga");
  });

  it("fetchViaCep success / not_found / invalid", async () => {
    const httpGet = jest.fn().mockResolvedValue({
      data: {
        cep: "29100-000",
        logradouro: "Rua Exemplo",
        bairro: "Centro",
        localidade: "Vila Velha",
        uf: "ES",
      },
    });
    const ok = await fetchViaCep("29100-000", { httpGet });
    expect(ok.status).toBe("success");
    expect(ok.address.city).toBe("Vila Velha");
    expect(httpGet.mock.calls[0][0]).toBe(
      "https://viacep.com.br/ws/29100000/json/"
    );

    httpGet.mockResolvedValueOnce({ data: { erro: true } });
    const nf = await fetchViaCep("00000000", { httpGet });
    expect(nf.status).toBe("not_found");

    httpGet.mockResolvedValueOnce({ data: "nope" });
    const inv = await fetchViaCep("11111111", { httpGet });
    expect(inv.status).toBe("invalid");
  });

  it("fetchViaCep rejeita comprimento inválido", async () => {
    await expect(fetchViaCep("29100", { httpGet: jest.fn() })).rejects.toThrow(
      "cep-invalid-length"
    );
  });
});
