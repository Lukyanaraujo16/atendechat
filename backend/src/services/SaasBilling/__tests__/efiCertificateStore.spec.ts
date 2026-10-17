import fs from "fs";
import os from "os";
import path from "path";
import AppError from "../../../errors/AppError";
import {
  fingerprintP12,
  getEfiCertificateRuntimeCacheDir,
  isFilesystemPrimaryCertStorageSupported,
  materializeEfiCertificateToRuntimePath,
  persistEfiCertificateEncrypted,
  revokeEfiCertificateRuntimeFile
} from "../efiCertificateStore";

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

  function fakeP12(): Buffer {
    const oid = Buffer.from([
      0x06, 0x08, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x0c, 0x01
    ]);
    return Buffer.concat([
      Buffer.from([0x30, 0x82]),
      Buffer.alloc(80, 0x01),
      oid,
      Buffer.alloc(40, 0x02)
    ]);
  }

  it("persiste blob cifrado com fingerprint e storageKey opaca", () => {
    const buf = fakeP12();
    const result = persistEfiCertificateEncrypted("homologation", buf);
    expect(result.storageKey.startsWith("efi-cert-homologation-")).toBe(true);
    expect(result.storageKey).not.toContain("..");
    expect(result.fingerprint).toBe(fingerprintP12(buf));
    expect(result.encryptedPayload.startsWith("efic1:")).toBe(true);
    expect(result.encryptedPayload).not.toContain(buf.toString("binary"));
  });

  it("rejeita buffer vazio ou tipo inválido", () => {
    expect(() =>
      persistEfiCertificateEncrypted("homologation", Buffer.alloc(0))
    ).toThrow(AppError);
    expect(() =>
      persistEfiCertificateEncrypted("homologation", Buffer.from("not-p12"))
    ).toThrow(AppError);
  });

  it("materializa em cache runtime privado e permite revogar arquivo", () => {
    const buf = fakeP12();
    const persisted = persistEfiCertificateEncrypted("homologation", buf);
    const abs = materializeEfiCertificateToRuntimePath({
      storageKey: persisted.storageKey,
      encryptedPayload: persisted.encryptedPayload
    });
    expect(abs.startsWith(getEfiCertificateRuntimeCacheDir())).toBe(true);
    expect(fs.existsSync(abs)).toBe(true);
    expect(fs.readFileSync(abs).equals(buf)).toBe(true);

    revokeEfiCertificateRuntimeFile(persisted.storageKey);
    expect(fs.existsSync(abs)).toBe(false);
  });

  it("filesystem-primary permanece desligado por padrão (sem volume Docker)", () => {
    expect(isFilesystemPrimaryCertStorageSupported()).toBe(false);
  });
});
