import fs from "fs";
import os from "os";
import path from "path";
import AppError from "../../../errors/AppError";
import {
  fingerprintP12,
  getEfiCertificateRuntimeCacheDir,
  isFilesystemPrimaryCertStorageSupported,
  persistEfiCertificateEncrypted,
  revokeEfiCertificateRuntimeFile
} from "../efiCertificateStore";
import { efiTestP12 } from "./fixtures/efiTestP12";

describe("efiCertificateStore", () => {
  const original = { ...process.env };
  let tmpDir: string;

  beforeEach(() => {
    process.env = { ...original };
    process.env.EFI_CREDENTIAL_ENCRYPTION_KEY = "cert-store-test-key-32chars!!";
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "efi-cert-test-"));
    process.env.EFI_CERT_RUNTIME_CACHE_DIR = tmpDir;
    delete process.env.EFI_CERT_FILESYSTEM_PRIMARY;
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  afterAll(() => {
    process.env = original;
  });

  const fakeP12 = efiTestP12;

  it("persiste blob cifrado com fingerprint e storageKey opaca", () => {
    const buf = fakeP12();
    const result = persistEfiCertificateEncrypted("homologation", buf);
    expect(result.storageKey.startsWith("efi-cert-homologation-")).toBe(true);
    expect(result.storageKey).not.toContain("..");
    expect(result.fingerprint).toBe(fingerprintP12(buf));
    expect(result.encryptedPayload.startsWith("efic1:")).toBe(true);
    expect(result.encryptedPayload).not.toContain(buf.toString("binary"));
  });

  it("T-CERT-03: ASN.1 aparente mas P12 que não abre → ERR_EFI_CERTIFICATE_INVALID", () => {
    const fake = Buffer.concat([Buffer.from([0x30, 0x82]), Buffer.alloc(120, 0x01)]);
    expect(() => persistEfiCertificateEncrypted("homologation", fake)).toThrow(
      expect.objectContaining({ message: "ERR_EFI_CERTIFICATE_INVALID" })
    );
  });

  it("rejeita buffer vazio ou tipo inválido", () => {
    expect(() =>
      persistEfiCertificateEncrypted("homologation", Buffer.alloc(0))
    ).toThrow(AppError);
    expect(() =>
      persistEfiCertificateEncrypted("homologation", Buffer.from("not-p12"))
    ).toThrow(AppError);
  });

  it("revoga arquivo legado deixado em cache runtime por versões anteriores", () => {
    const persisted = persistEfiCertificateEncrypted("homologation", fakeP12());
    const abs = path.join(getEfiCertificateRuntimeCacheDir(), `${persisted.storageKey}.p12`);
    fs.writeFileSync(abs, Buffer.from("leftover"));
    revokeEfiCertificateRuntimeFile(persisted.storageKey);
    expect(fs.existsSync(abs)).toBe(false);
  });

  it("filesystem-primary permanece desligado por padrão (sem volume Docker)", () => {
    expect(isFilesystemPrimaryCertStorageSupported()).toBe(false);
  });
});
