import { computeEfiConfigFingerprint } from "../../efiConfigFingerprint";

/**
 * P12 autoassinado SOMENTE para testes (CN=b31-test-fixture, senha vazia).
 * Não pertence a nenhuma conta Efí; não é segredo.
 */
export const EFI_TEST_P12_BASE64 =
  "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";

export const efiTestP12 = (): Buffer => Buffer.from(EFI_TEST_P12_BASE64, "base64");

/**
 * Registro PlatformEfiConfig com configuração válida (D-P2) para testes.
 * Exige EFI_CREDENTIAL_ENCRYPTION_KEY definida antes da chamada.
 */
export function buildValidEfiConfigRow(
  encryptSecret: (v: string) => string,
  encryptBinary: (b: Buffer) => string,
  overrides: Record<string, unknown> = {}
): Record<string, any> {
  return {
    id: 7,
    slot: "homologation",
    efiEnvironment: "sandbox",
    status: "auth_validated",
    clientIdEncrypted: encryptSecret("Client_Id_FROM_DB_abc"),
    clientSecretEncrypted: encryptSecret("Client_Secret_FROM_DB_xyz"),
    clientIdMasked: "****_abc",
    pixKeyEncrypted: encryptSecret("pix-key-db"),
    pixKeyMasked: "****y-db",
    webhookSecretEncrypted: encryptSecret("w".repeat(40)),
    webhookSecretConfigured: true,
    cobrancasClientIdEncrypted: null,
    cobrancasClientSecretEncrypted: null,
    cobrancasClientIdMasked: null,
    certificateEncrypted: encryptBinary(efiTestP12()),
    certificateStorageKey: "efi-cert-homologation-aabb",
    certificateFingerprint: "f".repeat(64),
    lastAuthTestOk: true,
    adminEnabled: true,
    pixHomologated: false,
    activatedAt: new Date("2026-10-20T10:00:00Z"),
    updatedAt: new Date("2026-10-20T10:00:00Z"),
    ...overrides
  };
}

/** Auditoria `activate` da B3.1: validação Pix do fingerprint atual (P-B31-03). */
export function efiActivationAudit(
  row: Record<string, any>,
  extra: Record<string, unknown> = {}
): Record<string, any> {
  return {
    id: 50,
    createdAt: new Date("2026-10-20T10:00:00Z"),
    diffSummary: JSON.stringify({
      adminEnabled: true,
      pixOAuthValidated: true,
      configFingerprint: computeEfiConfigFingerprint(row as any),
      efiEnvironment: row.efiEnvironment,
      ...extra
    })
  };
}

/** Ativação gravada pela B2: sem fingerprint nem ambiente validados. */
export const EFI_B2_ACTIVATION_AUDIT = {
  id: 40,
  createdAt: new Date("2026-10-16T10:00:00Z"),
  diffSummary: JSON.stringify({
    adminEnabled: true,
    pixHomologated: false,
    checkoutUnchanged: true
  })
};

/** `PlatformEfiConfigAudit.findOne` por ação (`activate`, `homologate`). */
export function mockEfiAuditsByAction(
  findOne: jest.Mock,
  byAction: Record<string, unknown>
): void {
  findOne.mockImplementation(async (opts: any) => byAction[opts?.where?.action] ?? null);
}
