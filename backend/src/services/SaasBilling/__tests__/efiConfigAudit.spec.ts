import { sanitizeEfiAuditDiff } from "../efiConfigAudit";

describe("efiConfigAudit sanitize", () => {
  it("redige secrets e ciphertext", () => {
    const safe = sanitizeEfiAuditDiff({
      action: "rotate_secret",
      clientSecret: "super-secret",
      clientSecretEncrypted: "efic1:abc",
      clientIdMasked: "****abcd",
      certificateEncrypted: "efic1:p12data",
      certificateFingerprint: "abc123",
      clientSecretRotated: true
    });
    expect(safe.clientSecret).toBe("[redacted]");
    expect(safe.clientSecretEncrypted).toBe("[redacted]");
    expect(safe.certificateEncrypted).toBe("[redacted]");
    expect(safe.clientIdMasked).toBe("****abcd");
    expect(safe.certificateFingerprint).toBe("abc123");
    expect(safe.clientSecretRotated).toBe(true);
    expect(JSON.stringify(safe)).not.toContain("super-secret");
    expect(JSON.stringify(safe)).not.toContain("efic1:");
  });
});
