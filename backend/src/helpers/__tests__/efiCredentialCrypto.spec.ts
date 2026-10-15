import AppError from "../../errors/AppError";
import {
  decryptEfiBinary,
  decryptEfiSecret,
  encryptEfiBinary,
  encryptEfiSecret,
  EFI_CREDENTIAL_CRYPTO_PREFIX,
  maskEfiSecret
} from "../efiCredentialCrypto";

describe("efiCredentialCrypto", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    process.env.EFI_CREDENTIAL_ENCRYPTION_KEY = "test-efi-key-32chars-minimum!!";
  });

  afterAll(() => {
    process.env = original;
  });

  it("encrypt/decrypt round-trip de texto", () => {
    const plain = "Client_Secret_VALUE_xyz";
    const enc = encryptEfiSecret(plain);
    expect(enc.startsWith(EFI_CREDENTIAL_CRYPTO_PREFIX)).toBe(true);
    expect(enc).not.toContain(plain);
    expect(decryptEfiSecret(enc)).toBe(plain);
  });

  it("encrypt/decrypt round-trip de binário (P12)", () => {
    const plain = Buffer.from([0x30, 0x82, 0x01, 0x00, 0xaa, 0xbb]);
    const enc = encryptEfiBinary(plain);
    expect(enc.startsWith(EFI_CREDENTIAL_CRYPTO_PREFIX)).toBe(true);
    expect(decryptEfiBinary(enc).equals(plain)).toBe(true);
  });

  it("falha com chave ausente", () => {
    delete process.env.EFI_CREDENTIAL_ENCRYPTION_KEY;
    expect(() => encryptEfiSecret("abc")).toThrow(AppError);
    try {
      encryptEfiSecret("abc");
    } catch (e) {
      expect((e as AppError).message).toBe(
        "ERR_EFI_CREDENTIAL_ENCRYPTION_KEY_MISSING"
      );
    }
  });

  it("não usa chave de IA como fallback", () => {
    delete process.env.EFI_CREDENTIAL_ENCRYPTION_KEY;
    process.env.AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY = "ai-key-should-not-work";
    process.env.META_TOKEN_ENCRYPTION_KEY = "meta-key-should-not-work";
    expect(() => encryptEfiSecret("abc")).toThrow(AppError);
  });

  it("falha com ciphertext adulterado", () => {
    const enc = encryptEfiSecret("secret-value");
    const tampered = `${enc.slice(0, -4)}XXXX`;
    expect(() => decryptEfiSecret(tampered)).toThrow(AppError);
  });

  it("falha com chave incorreta", () => {
    const enc = encryptEfiSecret("secret-value");
    process.env.EFI_CREDENTIAL_ENCRYPTION_KEY = "outra-chave-diferente-xxxxx";
    expect(() => decryptEfiSecret(enc)).toThrow(AppError);
  });

  it("máscara não expõe o valor completo", () => {
    const masked = maskEfiSecret("Client_Id_ABCDEFGH");
    expect(masked).not.toContain("Client_Id_ABCDEF");
    expect(masked.endsWith("EFGH")).toBe(true);
    expect(masked.includes("*")).toBe(true);
  });

  it("rejeita plaintext vazio", () => {
    expect(() => encryptEfiSecret("")).toThrow(AppError);
  });
});
