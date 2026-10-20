import fs from "fs";
import http from "http";
import { AddressInfo } from "net";
import axios from "axios";
import {
  assertEfiP12Opens,
  createEfiPixClient,
  EFI_PIX_BASE_URLS,
  EFI_PIX_OAUTH_TIMEOUT_MS,
  EFI_PIX_REQUEST_TIMEOUT_MS,
  invalidateEfiPixTokenCache,
  testEfiPixOAuth
} from "../efiPixClient";
import { efiTestP12 } from "./fixtures/efiTestP12";

const baseInput = () => ({
  efiEnvironment: "sandbox" as const,
  clientId: "Client_Id_PIX",
  clientSecret: "Client_Secret_PIX_value",
  pfx: efiTestP12()
});

describe("B3.1 — efiPixClient (D-P12)", () => {
  const realTimeout = AbortSignal.timeout.bind(AbortSignal);

  beforeEach(() => {
    jest.restoreAllMocks();
    invalidateEfiPixTokenCache();
  });

  it("PT-4: bases oficiais por ambiente", () => {
    expect(EFI_PIX_BASE_URLS).toEqual({
      sandbox: "https://pix-h.api.efipay.com.br",
      production: "https://pix.api.efipay.com.br"
    });
    expect(createEfiPixClient(baseInput()).baseURL).toBe("https://pix-h.api.efipay.com.br");
    expect(
      createEfiPixClient({ ...baseInput(), efiEnvironment: "production" }).baseURL
    ).toBe("https://pix.api.efipay.com.br");
  });

  it("T-CERT-01: OAuth com mTLS em memória, sem gravar arquivo", async () => {
    const writes = [
      jest.spyOn(fs, "writeFileSync"),
      jest.spyOn(fs, "writeFile"),
      jest.spyOn(fs, "createWriteStream"),
      jest.spyOn(fs, "mkdtempSync"),
      jest.spyOn(fs.promises, "writeFile")
    ];
    const post = jest
      .spyOn(axios, "post")
      .mockResolvedValue({ status: 200, data: { access_token: "tok-1", expires_in: 3600 } });

    const token = await createEfiPixClient(baseInput()).getAccessToken();
    expect(token).toBe("tok-1");

    const [url, body, config] = post.mock.calls[0] as any[];
    expect(url).toBe("https://pix-h.api.efipay.com.br/oauth/token");
    expect(body).toEqual({ grant_type: "client_credentials" });
    expect(config.headers.Authorization).toBe(
      `Basic ${Buffer.from("Client_Id_PIX:Client_Secret_PIX_value").toString("base64")}`
    );
    expect(config.httpsAgent.options.pfx.equals(efiTestP12())).toBe(true);
    expect(config.timeout).toBe(EFI_PIX_OAUTH_TIMEOUT_MS);
    expect(config.signal).toBeDefined();
    writes.forEach(w => expect(w).not.toHaveBeenCalled());
  });

  it("T-CERT-03: P12 corrompido → erro tipado antes de qualquer chamada", () => {
    const post = jest.spyOn(axios, "post");
    expect(() => assertEfiP12Opens(Buffer.from("nao-e-p12"))).toThrow(
      expect.objectContaining({ message: "ERR_EFI_CERTIFICATE_INVALID" })
    );
    expect(() => createEfiPixClient({ ...baseInput(), pfx: Buffer.alloc(0) })).toThrow(
      expect.objectContaining({ message: "ERR_EFI_CERTIFICATE_MISSING" })
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("cache de token por chave; invalidação força novo OAuth", async () => {
    const post = jest
      .spyOn(axios, "post")
      .mockResolvedValue({ status: 200, data: { access_token: "tok", expires_in: 3600 } });
    const input = { ...baseInput(), tokenCacheKey: "db:7:1:sandbox" };
    await createEfiPixClient(input).getAccessToken();
    await createEfiPixClient(input).getAccessToken();
    expect(post).toHaveBeenCalledTimes(1);

    await createEfiPixClient({ ...input, tokenCacheKey: "db:7:2:sandbox" }).getAccessToken();
    expect(post).toHaveBeenCalledTimes(2);

    invalidateEfiPixTokenCache();
    await createEfiPixClient(input).getAccessToken();
    expect(post).toHaveBeenCalledTimes(3);
  });

  it("T-SEC-02: erro OAuth sanitizado (sem Bearer, client_secret, PEM)", async () => {
    jest.spyOn(axios, "post").mockRejectedValue({
      response: {
        status: 401,
        data: {
          error_description:
            "invalid client_secret=Client_Secret_PIX_value Bearer abc.def -----BEGIN PRIVATE KEY-----xx-----END PRIVATE KEY-----"
        }
      }
    });
    const err: any = await createEfiPixClient(baseInput())
      .getAccessToken()
      .catch(e => e);
    expect(err.message).toBe("ERR_EFI_PIX_AUTH_FAILED");
    const text = JSON.stringify(err);
    expect(text).not.toContain("Client_Secret_PIX_value");
    expect(text).not.toContain("abc.def");
    expect(text).not.toContain("BEGIN PRIVATE KEY");
  });

  it("request usa Bearer, timeout de 20 s e limpa token em 401", async () => {
    jest
      .spyOn(axios, "post")
      .mockResolvedValue({ status: 200, data: { access_token: "tok", expires_in: 3600 } });
    const req = jest
      .spyOn(axios, "request")
      .mockResolvedValueOnce({ status: 200, data: { ok: 1 } } as any)
      .mockRejectedValueOnce({ response: { status: 401, data: { nome: "x" } } });
    const client = createEfiPixClient({ ...baseInput(), tokenCacheKey: "k1" });

    await expect(client.request({ method: "GET", path: "/v2/cob/abc" })).resolves.toEqual({
      status: 200,
      data: { ok: 1 }
    });
    const cfg = req.mock.calls[0][0] as any;
    expect(cfg.url).toBe("https://pix-h.api.efipay.com.br/v2/cob/abc");
    expect(cfg.headers.Authorization).toBe("Bearer tok");
    expect(cfg.timeout).toBe(EFI_PIX_REQUEST_TIMEOUT_MS);

    await expect(client.request({ method: "GET", path: "/v2/cob/abc" })).rejects.toMatchObject({
      message: "ERR_EFI_PIX_HTTP_ERROR"
    });
    await client.getAccessToken();
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  describe("rede real (servidor local)", () => {
    let server: http.Server;
    let baseUrl: string;
    let mode: "hang" | "reset" | "ok-then-hang";

    beforeAll(async () => {
      server = http.createServer((req, res) => {
        if (mode === "reset") {
          req.socket.destroy();
          return;
        }
        if (mode === "ok-then-hang" && req.url === "/oauth/token") {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ access_token: "tok", expires_in: 3600 }));
        }
        // demais casos: nunca responde
      });
      await new Promise<void>(r => server.listen(0, "127.0.0.1", () => r()));
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterAll(async () => {
      (server as any).closeAllConnections?.();
      await new Promise(r => server.close(r));
    });

    // Encurta o teto (15 s / 20 s) para o teste: o signal é o que garante o teto total.
    // Só o teto alvo é encurtado; o outro mantém o valor real (evita corrida sob carga).
    const shortenTimeouts = (target: number) =>
      jest
        .spyOn(AbortSignal, "timeout")
        .mockImplementation(ms => realTimeout(ms === target ? 80 : ms));

    it("T-NET-01: OAuth pendurado → ERR_EFI_PIX_TIMEOUT (teto de 15 s)", async () => {
      mode = "hang";
      const spy = shortenTimeouts(EFI_PIX_OAUTH_TIMEOUT_MS);
      const started = Date.now();
      await expect(
        createEfiPixClient({ ...baseInput(), baseUrl }).getAccessToken()
      ).rejects.toMatchObject({ message: "ERR_EFI_PIX_TIMEOUT", statusCode: 504 });
      expect(Date.now() - started).toBeLessThan(5_000);
      expect(spy).toHaveBeenCalledWith(EFI_PIX_OAUTH_TIMEOUT_MS);
    });

    it("T-NET-09: operação pendurada → ERR_EFI_PIX_TIMEOUT (teto de 20 s)", async () => {
      mode = "ok-then-hang";
      const spy = shortenTimeouts(EFI_PIX_REQUEST_TIMEOUT_MS);
      const client = createEfiPixClient({ ...baseInput(), baseUrl });
      await expect(client.request({ method: "GET", path: "/v2/cob/x" })).rejects.toMatchObject({
        message: "ERR_EFI_PIX_TIMEOUT"
      });
      expect(spy).toHaveBeenCalledWith(EFI_PIX_REQUEST_TIMEOUT_MS);
    });

    it("T-NET-02: ECONNRESET → promise rejeitada com erro tipado", async () => {
      mode = "reset";
      await expect(
        createEfiPixClient({ ...baseInput(), baseUrl }).getAccessToken()
      ).rejects.toMatchObject({ message: "ERR_EFI_PIX_NETWORK", statusCode: 502 });
    });

    it("T-CRED-12: teste de conexão separa P12 inválido de OAuth falho", async () => {
      mode = "reset";
      const bad = await testEfiPixOAuth({ ...baseInput(), pfx: Buffer.from("x".repeat(80)) });
      expect(bad).toMatchObject({ ok: false, certificateValid: false });

      const netFail = await testEfiPixOAuth({ ...baseInput(), baseUrl });
      expect(netFail).toMatchObject({ ok: false, certificateValid: true });
      expect(JSON.stringify(netFail)).not.toContain("Client_Secret_PIX_value");
    });
  });
});
