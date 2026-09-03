/* eslint-disable import/first */
const mockPost = jest.fn();
const mockAxiosGet = jest.fn();
const findOneCred = jest.fn();

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      post: (...a: unknown[]) => mockPost(...a),
      get: jest.fn(),
      delete: jest.fn()
    })),
    get: (...a: unknown[]) => mockAxiosGet(...a)
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
  evolutionDownloadMediaFromUrl,
  evolutionGetBase64FromMediaMessage
} from "../evolutionHttpClient";

describe("evolutionHttpClient mídia Evolution v2.3.7", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findOneCred.mockResolvedValue({
      baseUrl: "https://evo.example.com",
      instanceName: "streamhub-c1-w3",
      apiKeyEncrypted: "evo1:encrypted-fixture"
    });
  });

  it("getBase64FromMediaMessage envia key.id e convertToMp4", async () => {
    mockPost.mockResolvedValue({
      status: 200,
      data: {
        base64: Buffer.from("img").toString("base64"),
        mimetype: "image/jpeg"
      }
    });
    const result = await evolutionGetBase64FromMediaMessage({
      whatsappId: 3,
      messageId: "3A5809589B19B293D6F5",
      convertToMp4: false
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    const [path, body] = mockPost.mock.calls[0];
    expect(path).toBe("/chat/getBase64FromMediaMessage/streamhub-c1-w3");
    expect(body).toEqual({
      message: { key: { id: "3A5809589B19B293D6F5" } },
      convertToMp4: false
    });
    expect(result.mimetype).toBe("image/jpeg");
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it("URL CDN WhatsApp não dispara GET direto", async () => {
    await expect(
      evolutionDownloadMediaFromUrl({
        whatsappId: 3,
        mediaUrl: "https://mmg.whatsapp.net/v/t62.7118-24/example",
        maxBytes: 1024
      })
    ).rejects.toMatchObject({ code: "ERR_EVOLUTION_MEDIA_URL_BLOCKED" });
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });
});
