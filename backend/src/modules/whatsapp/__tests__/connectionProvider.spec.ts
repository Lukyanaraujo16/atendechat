import {
  WhatsAppConnectionProvider,
  isBaileysConnection,
  isEvolutionConnection,
  isWhatsAppConnectionProvider,
  parseWhatsAppConnectionProviderInput,
  resolveWhatsAppConnectionProvider
} from "../connectionProvider";

describe("WhatsApp connectionProvider", () => {
  it("omite / null / vazio → baileys", () => {
    expect(parseWhatsAppConnectionProviderInput(undefined)).toBe("baileys");
    expect(parseWhatsAppConnectionProviderInput(null)).toBe("baileys");
    expect(parseWhatsAppConnectionProviderInput("")).toBe("baileys");
    expect(resolveWhatsAppConnectionProvider({})).toBe("baileys");
    expect(
      resolveWhatsAppConnectionProvider({ connectionProvider: null })
    ).toBe("baileys");
  });

  it("aceita baileys explícito", () => {
    expect(parseWhatsAppConnectionProviderInput("baileys")).toBe(
      WhatsAppConnectionProvider.BAILEYS
    );
    expect(isBaileysConnection({ connectionProvider: "baileys" })).toBe(true);
    expect(isEvolutionConnection({ connectionProvider: "baileys" })).toBe(
      false
    );
  });

  it("aceita evolution explícito", () => {
    expect(parseWhatsAppConnectionProviderInput("evolution")).toBe(
      WhatsAppConnectionProvider.EVOLUTION
    );
    expect(isEvolutionConnection({ connectionProvider: "evolution" })).toBe(
      true
    );
    expect(isBaileysConnection({ connectionProvider: "evolution" })).toBe(
      false
    );
  });

  it("rejeita provider inválido", () => {
    expect(() => parseWhatsAppConnectionProviderInput("meta")).toThrow(
      /ERR_WHATSAPP_CONNECTION_PROVIDER_INVALID/
    );
    expect(isWhatsAppConnectionProvider("meta")).toBe(false);
  });

  it("não confunde com Whatsapp.provider legado stable/beta", () => {
    expect(
      resolveWhatsAppConnectionProvider({
        connectionProvider: undefined
      } as { connectionProvider?: string })
    ).toBe("baileys");
    // stable/beta NÃO são connectionProvider
    expect(isWhatsAppConnectionProvider("stable")).toBe(false);
    expect(isWhatsAppConnectionProvider("beta")).toBe(false);
  });
});
