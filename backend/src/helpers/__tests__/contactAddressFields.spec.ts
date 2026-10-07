import AppError from "../../errors/AppError";
import { pickContactAddressFields } from "../contactAddressFields";

describe("pickContactAddressFields", () => {
  it("salva/lê campos opcionais e ignora ausentes", () => {
    expect(pickContactAddressFields({})).toEqual({});
    expect(
      pickContactAddressFields({
        postalCode: "01310-100",
        street: "Av Paulista",
        addressNumber: "1000",
        addressComplement: "",
        district: "Bela Vista",
        city: "São Paulo",
        state: "sp"
      })
    ).toEqual({
      postalCode: "01310-100",
      street: "Av Paulista",
      addressNumber: "1000",
      addressComplement: null,
      district: "Bela Vista",
      city: "São Paulo",
      state: "SP"
    });
  });

  it("contato sem endereço continua válido e rejeita UF inválida", () => {
    expect(pickContactAddressFields({ name: "X" } as any)).toEqual({});
    expect(() => pickContactAddressFields({ state: "XX" })).toThrow(AppError);
  });
});
