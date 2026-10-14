import axios from "axios";
import fs from "fs";
import {
  __resetEfiAuthTestRateLimitForTests,
  assertEfiAuthTestRateLimit,
  getEfiIntegrationStatus,
  sanitizeEfiAuthErrorMessage,
  testEfiCobrancasAuthentication
} from "../efiIntegrationStatus";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("efiIntegrationStatus", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    __resetEfiAuthTestRateLimitForTests();
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = { ...original };
  });

  it("não expõe secrets, tokens nem caminhos no status", () => {
    process.env.GERENCIANET_SANDBOX = "true";
    process.env.GERENCIANET_CLIENT_ID = "Client_Id_SECRET_VALUE";
    process.env.GERENCIANET_CLIENT_SECRET = "Client_Secret_SECRET_VALUE";
    process.env.GERENCIANET_PIX_CERT = "meu-cert";
    process.env.GERENCIANET_PIX_KEY = "chave-pix-secreta";
    process.env.WEBHOOK_SUBSCRIPTION_SECRET = "whsec";

    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    const status = getEfiIntegrationStatus();
    const json = JSON.stringify(status);

    expect(json).not.toContain("Client_Id_SECRET_VALUE");
    expect(json).not.toContain("Client_Secret_SECRET_VALUE");
    expect(json).not.toContain("chave-pix-secreta");
    expect(json).not.toContain("whsec");
    expect(json).not.toContain(".p12");
    expect(json).not.toContain("/certs/");
    expect(status.credentials.clientIdConfigured).toBe(true);
    expect(status.credentials.clientSecretConfigured).toBe(true);
    expect(status.certificate.nameConfigured).toBe(true);
    expect(status.certificate.fileFound).toBe(false);
    expect(status.environment).toBe("sandbox");
    expect(status.authTests.pixIsolatedAuthAvailable).toBe(false);
  });

  it("marca credenciais e certificado ausentes", () => {
    delete process.env.GERENCIANET_CLIENT_ID;
    delete process.env.GERENCIANET_CLIENT_SECRET;
    delete process.env.GERENCIANET_PIX_CERT;
    delete process.env.EFI_COBRANCAS_CLIENT_ID;
    delete process.env.EFI_COBRANCAS_CLIENT_SECRET;
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    const status = getEfiIntegrationStatus();
    expect(status.credentials.clientIdConfigured).toBe(false);
    expect(status.credentials.clientSecretConfigured).toBe(false);
    expect(status.certificate.fileFound).toBe(false);
    expect(status.readiness.pix.ready).toBe(false);
    expect(status.readiness.cobrancas.ready).toBe(false);
    expect(status.readiness.pix.missing.length).toBeGreaterThan(0);
  });

  it("sanitiza erros de autenticação", () => {
    const msg = sanitizeEfiAuthErrorMessage({
      message: "invalid_client Bearer abc.def.ghi client_secret=supersecret"
    });
    expect(msg).not.toContain("supersecret");
    expect(msg).not.toContain("abc.def.ghi");
    expect(msg).toMatch(/Bearer \*\*\*/);
  });

  it("sanitiza timeout", () => {
    const msg = sanitizeEfiAuthErrorMessage({
      code: "ECONNABORTED",
      message: "timeout of 15000ms exceeded"
    });
    expect(msg).toMatch(/Timeout/i);
  });

  it("teste OAuth falha sem credenciais sem chamar a API", async () => {
    delete process.env.GERENCIANET_CLIENT_ID;
    delete process.env.GERENCIANET_CLIENT_SECRET;
    delete process.env.EFI_COBRANCAS_CLIENT_ID;
    delete process.env.EFI_COBRANCAS_CLIENT_SECRET;

    const result = await testEfiCobrancasAuthentication();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/ausentes/i);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("teste OAuth sucesso não retorna access_token", async () => {
    process.env.GERENCIANET_CLIENT_ID = "id";
    process.env.GERENCIANET_CLIENT_SECRET = "secret";
    process.env.GERENCIANET_SANDBOX = "true";

    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { access_token: "SHOULD_NOT_LEAK", expires_in: 600, token_type: "Bearer" }
    } as any);

    const result = await testEfiCobrancasAuthentication();
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain("SHOULD_NOT_LEAK");
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const url = mockedAxios.post.mock.calls[0][0] as string;
    expect(url).toContain("/v1/authorize");
    expect(url).not.toContain("one-step");
    expect(url).not.toContain("/charge");
  });

  it("teste OAuth erro sanitizado", async () => {
    process.env.GERENCIANET_CLIENT_ID = "id";
    process.env.GERENCIANET_CLIENT_SECRET = "secret";

    mockedAxios.post.mockResolvedValue({
      status: 401,
      data: {
        error: "invalid_client",
        error_description: "client_secret=leaked-secret Bearer tok.xyz"
      }
    } as any);

    const result = await testEfiCobrancasAuthentication();
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain("leaked-secret");
    expect(result.message).not.toContain("tok.xyz");
  });

  it("rate limit bloqueia após excesso", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(assertEfiAuthTestRateLimit(42).allowed).toBe(true);
    }
    const blocked = assertEfiAuthTestRateLimit(42);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});
