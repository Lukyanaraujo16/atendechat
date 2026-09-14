/**
 * @jest-environment jsdom
 */
import {
  isSharedContactMediaType,
  looksLikeVcardBody,
  parseSharedContact,
} from "../parseSharedContact";

const FULL_VCARD = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "N:Silva;Maria;;;",
  "FN:Maria Silva",
  "TEL;TYPE=CELL:+5527999999999",
  "END:VCARD",
].join("\n");

describe("parseSharedContact", () => {
  it("extrai FN e TEL de contactMessage Evolution", () => {
    const parsed = parseSharedContact(FULL_VCARD);
    expect(parsed.isVcard).toBe(true);
    expect(parsed.name).toBe("Maria Silva");
    expect(parsed.phone).toBe("+5527999999999");
    expect(parsed.displayName).toBe("Maria Silva");
    expect(looksLikeVcardBody(FULL_VCARD)).toBe(true);
  });

  it("vcard legado também renderiza FN e TEL", () => {
    const parsed = parseSharedContact(FULL_VCARD);
    expect(isSharedContactMediaType("vcard")).toBe(true);
    expect(isSharedContactMediaType("contactMessage")).toBe(true);
    expect(parsed.displayName).toBe("Maria Silva");
    expect(parsed.phone).toContain("5527");
  });

  it("ausência de FN usa N quando existir", () => {
    const parsed = parseSharedContact(
      ["BEGIN:VCARD", "VERSION:3.0", "N:Souza;João;;;", "END:VCARD"].join("\n")
    );
    expect(parsed.name).toBe("João Souza");
    expect(parsed.phone).toBe("");
    expect(parsed.displayName).toBe("João Souza");
  });

  it("ausência de TEL mantém o nome", () => {
    const parsed = parseSharedContact(
      ["BEGIN:VCARD", "FN:Ana Costa", "END:VCARD"].join("\n")
    );
    expect(parsed.name).toBe("Ana Costa");
    expect(parsed.phone).toBe("");
    expect(parsed.displayName).toBe("Ana Costa");
  });

  it("conteúdo inválido tem fallback seguro e não devolve vCard cru", () => {
    const parsed = parseSharedContact("BEGIN:VCARD\nEND:VCARD");
    expect(parsed.displayName).toBe("Contato");
    expect(parsed.phone).toBe("");
    expect(parsed.displayName).not.toMatch(/BEGIN:VCARD/i);
  });

  it("mensagens comuns não são tratadas como vCard", () => {
    expect(looksLikeVcardBody("olá, tudo bem?")).toBe(false);
    expect(isSharedContactMediaType("conversation")).toBe(false);
    expect(isSharedContactMediaType("image")).toBe(false);
    expect(parseSharedContact("olá, tudo bem?").isVcard).toBe(false);
  });
});
