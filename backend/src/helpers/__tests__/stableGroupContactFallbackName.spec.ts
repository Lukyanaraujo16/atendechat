import { buildStableGroupContactFallbackName } from "../stableGroupContactFallbackName";

describe("buildStableGroupContactFallbackName", () => {
  it("usa dígitos do grupo e nunca pushName", () => {
    expect(buildStableGroupContactFallbackName("120363111222333")).toBe(
      "Grupo 120363111222333"
    );
    expect(buildStableGroupContactFallbackName("120363111222333@g.us")).toBe(
      "Grupo 120363111222333"
    );
    expect(buildStableGroupContactFallbackName("")).toBe("Grupo");
  });

  it("nameDigits coincidem com Contact.number para upgrade futuro de subject", () => {
    const digits = "120363111222333";
    const name = buildStableGroupContactFallbackName(digits);
    expect(name.replace(/\D/g, "")).toBe(digits);
    expect(name).not.toBe("João");
  });
});
