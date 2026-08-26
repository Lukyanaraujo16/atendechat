import {
  encryptEvolutionApiKey,
  decryptEvolutionApiKey
} from "../evolutionCredentialCrypto";
import { serializeEvolutionCredentialPublic } from "../../services/WhatsappService/evolutionCredentialsService";

describe("evolution credentials security", () => {
  const prev = process.env.EVOLUTION_CREDENTIAL_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.EVOLUTION_CREDENTIAL_ENCRYPTION_KEY =
      "fase5-test-evolution-secret-key";
  });

  afterAll(() => {
    if (prev === undefined) {
      delete process.env.EVOLUTION_CREDENTIAL_ENCRYPTION_KEY;
    } else {
      process.env.EVOLUTION_CREDENTIAL_ENCRYPTION_KEY = prev;
    }
  });

  it("cifra e decifra API key com prefixo evo1:", () => {
    const cipher = encryptEvolutionApiKey("super-secret-api-key");
    expect(cipher.startsWith("evo1:")).toBe(true);
    expect(cipher).not.toContain("super-secret");
    expect(decryptEvolutionApiKey(cipher)).toBe("super-secret-api-key");
  });

  it("serialização pública não inclui apiKeyEncrypted nem secret", () => {
    const publicRow = serializeEvolutionCredentialPublic({
      id: 1,
      whatsappId: 10,
      baseUrl: "https://evo.example",
      instanceName: "inst1",
      instanceId: null,
      apiKeyMasked: "supe••••-key",
      apiKeyEncrypted: "evo1:SHOULD_NOT_APPEAR"
    } as never);

    expect(publicRow).toEqual({
      id: 1,
      whatsappId: 10,
      baseUrl: "https://evo.example",
      instanceName: "inst1",
      instanceId: null,
      apiKeyMasked: "supe••••-key"
    });
    expect(JSON.stringify(publicRow)).not.toMatch(/SHOULD_NOT_APPEAR|evo1:/);
  });
});
