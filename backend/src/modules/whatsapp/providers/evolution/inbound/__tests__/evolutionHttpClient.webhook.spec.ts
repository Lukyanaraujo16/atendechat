/* eslint-disable import/first */
const mockPost = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerInfo = jest.fn();
const findOneCred = jest.fn();

const FIXTURE_API_KEY = "fixture-connection-apikey";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      post: (...a: unknown[]) => mockPost(...a),
      get: jest.fn(),
      delete: jest.fn()
    }))
  }
}));

jest.mock("../../../../../../utils/logger", () => ({
  logger: {
    warn: (...a: unknown[]) => mockLoggerWarn(...a),
    info: (...a: unknown[]) => mockLoggerInfo(...a),
    error: jest.fn()
  }
}));

jest.mock("../../../../../../helpers/evolutionCredentialCrypto", () => ({
  decryptEvolutionApiKey: () => "fixture-connection-apikey"
}));

jest.mock("../../../../../../models/WhatsappEvolutionCredential", () => ({
  __esModule: true,
  default: {
    unscoped: () => ({
      findOne: (...a: unknown[]) => findOneCred(...a)
    })
  }
}));

import {
  evolutionCreateInstance,
  evolutionSetWebhook
} from "../evolutionHttpClient";

function loggerPayloadContainsSecret(): boolean {
  const chunks = [...mockLoggerWarn.mock.calls, ...mockLoggerInfo.mock.calls];
  return JSON.stringify(chunks).includes(FIXTURE_API_KEY);
}

describe("evolutionSetWebhook — headers.apikey da credencial", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findOneCred.mockResolvedValue({
      baseUrl: "https://evo.example.com",
      instanceName: "streamhub-c1-w3",
      apiKeyEncrypted: "evo1:encrypted-fixture"
    });
    mockPost.mockResolvedValue({ status: 200, data: { ok: true } });
  });

  it("envia headers.apikey carregada por whatsappId", async () => {
    await evolutionSetWebhook({
      whatsappId: 3,
      webhookUrl: "https://api.example.com/webhooks/evolution/3"
    });

    expect(findOneCred).toHaveBeenCalledWith(
      expect.objectContaining({ where: { whatsappId: 3 } })
    );
    expect(mockPost).toHaveBeenCalledTimes(1);

    const [path, body] = mockPost.mock.calls[0];
    expect(path).toBe("/webhook/set/streamhub-c1-w3");
    expect(body).toEqual(
      expect.objectContaining({
        enabled: true,
        url: "https://api.example.com/webhooks/evolution/3",
        webhookByEvents: false,
        webhookBase64: false,
        events: expect.arrayContaining([
          "QRCODE_UPDATED",
          "CONNECTION_UPDATE",
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE"
        ]),
        headers: expect.objectContaining({
          apikey: expect.any(String)
        })
      })
    );
    expect(body.headers.apikey).toBe(FIXTURE_API_KEY);
    expect(loggerPayloadContainsSecret()).toBe(false);
  });
});

describe("evolutionCreateInstance — webhook.headers.apikey da credencial", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findOneCred.mockResolvedValue({
      baseUrl: "https://evo.example.com",
      instanceName: "streamhub-c1-w3",
      apiKeyEncrypted: "evo1:encrypted-fixture"
    });
    mockPost.mockResolvedValue({ status: 201, data: { ok: true } });
  });

  it("embute webhook.headers.apikey carregada por whatsappId", async () => {
    await evolutionCreateInstance({
      whatsappId: 3,
      instanceName: "streamhub-c1-w3",
      webhookUrl: "https://api.example.com/webhooks/evolution/3"
    });

    expect(findOneCred).toHaveBeenCalledWith(
      expect.objectContaining({ where: { whatsappId: 3 } })
    );
    expect(mockPost).toHaveBeenCalledTimes(1);

    const [path, body] = mockPost.mock.calls[0];
    expect(path).toBe("/instance/create");
    expect(body).toEqual(
      expect.objectContaining({
        instanceName: "streamhub-c1-w3",
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        webhook: expect.objectContaining({
          enabled: true,
          url: "https://api.example.com/webhooks/evolution/3",
          byEvents: false,
          base64: false,
          events: expect.arrayContaining([
            "QRCODE_UPDATED",
            "CONNECTION_UPDATE",
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE"
          ]),
          headers: expect.objectContaining({
            apikey: expect.any(String)
          })
        })
      })
    );
    expect(body.webhook.headers.apikey).toBe(FIXTURE_API_KEY);
    expect(loggerPayloadContainsSecret()).toBe(false);
  });
});
