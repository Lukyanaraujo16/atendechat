import {
  addressFromContact,
  isContactAddressComplete,
  requiredDeliveryAddressErrors,
} from "../wizard/deliveryAddressUtils";

describe("deliveryAddressUtils", () => {
  it("valida obrigatórios e CEP/complemento opcionais", () => {
    const incomplete = requiredDeliveryAddressErrors({
      recipientName: "Ana",
      recipientPhone: "11",
      street: "Rua",
      number: "",
      district: "Centro",
      city: "SP",
      state: "SP",
    });
    expect(incomplete.number).toBe(true);
    expect(incomplete.postalCode).toBeUndefined();

    const full = {
      recipientName: "Ana",
      recipientPhone: "11999999999",
      street: "Rua A",
      number: "10",
      district: "Centro",
      city: "São Paulo",
      state: "SP",
    };
    expect(Object.keys(requiredDeliveryAddressErrors(full))).toHaveLength(0);
  });

  it("detecta endereço completo do Contact", () => {
    expect(
      isContactAddressComplete({
        name: "Ana",
        number: "11",
        street: "Rua",
        addressNumber: "1",
        district: "Bairro",
        city: "Cidade",
        state: "SP",
      })
    ).toBe(true);
    expect(isContactAddressComplete({ name: "Ana", number: "11" })).toBe(false);
    expect(addressFromContact({ name: "Ana", number: "11" }).recipientName).toBe(
      "Ana"
    );
  });
});
