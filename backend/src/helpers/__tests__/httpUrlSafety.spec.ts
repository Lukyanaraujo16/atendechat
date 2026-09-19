import {
  assertSafePublicHttpUrl,
  isPrivateOrLocalHost
} from "../httpUrlSafety";

describe("httpUrlSafety 12.3-F SSRF", () => {
  it("bloqueia localhost / loopback / metadata / privado", () => {
    expect(isPrivateOrLocalHost("localhost")).toBe(true);
    expect(isPrivateOrLocalHost("127.0.0.1")).toBe(true);
    expect(isPrivateOrLocalHost("::1")).toBe(true);
    expect(isPrivateOrLocalHost("10.0.0.1")).toBe(true);
    expect(isPrivateOrLocalHost("192.168.1.10")).toBe(true);
    expect(isPrivateOrLocalHost("172.16.0.1")).toBe(true);
    expect(isPrivateOrLocalHost("169.254.169.254")).toBe(true);
    expect(isPrivateOrLocalHost("metadata.google.internal")).toBe(true);
  });

  it("rejeita file:// e protocolos não HTTP(S)", () => {
    expect(assertSafePublicHttpUrl("file:///etc/passwd").ok).toBe(false);
    expect(assertSafePublicHttpUrl("ftp://example.com/a").ok).toBe(false);
  });

  it("rejeita URL inválida", () => {
    expect(assertSafePublicHttpUrl("not a url")).toMatchObject({
      ok: false,
      reason: "invalid_url"
    });
  });

  it("rejeita host local na URL", () => {
    expect(assertSafePublicHttpUrl("http://127.0.0.1/x")).toMatchObject({
      ok: false,
      reason: "private_or_local_host"
    });
    expect(assertSafePublicHttpUrl("http://localhost/x")).toMatchObject({
      ok: false,
      reason: "private_or_local_host"
    });
    expect(assertSafePublicHttpUrl("http://[::1]/x")).toMatchObject({
      ok: false,
      reason: "private_or_local_host"
    });
  });

  it("aceita HTTP(S) público sem exigir host Evolution", () => {
    const r = assertSafePublicHttpUrl(
      "https://typebot.io/public/storage/image.jpg"
    );
    expect(r.ok).toBe(true);
  });
});
