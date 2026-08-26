import {
  assertSafeEvolutionMediaUrl,
  isPrivateOrLocalHost
} from "../evolutionUrlSafety";
import {
  decodeEvolutionBase64,
  extractEvolutionMedia
} from "../EvolutionMediaExtractor";
import { EvolutionHttpError } from "../evolutionHttpClient";
import { maxBytesForEvolutionMediaKind } from "../evolutionMediaLimits";
import { sanitizeEvolutionWebhookPayload } from "../evolutionWebhookTypes";

jest.mock("../evolutionHttpClient", () => {
  const actual = jest.requireActual("../evolutionHttpClient");
  return {
    ...actual,
    evolutionGetBase64FromMediaMessage: jest.fn(),
    evolutionDownloadMediaFromUrl: jest.fn()
  };
});

import {
  evolutionDownloadMediaFromUrl,
  evolutionGetBase64FromMediaMessage
} from "../evolutionHttpClient";

const getBase64 = evolutionGetBase64FromMediaMessage as jest.Mock;
const downloadUrl = evolutionDownloadMediaFromUrl as jest.Mock;

describe("evolutionUrlSafety SSRF", () => {
  it("bloqueia localhost / IP privado / metadata", () => {
    expect(isPrivateOrLocalHost("localhost")).toBe(true);
    expect(isPrivateOrLocalHost("127.0.0.1")).toBe(true);
    expect(isPrivateOrLocalHost("10.0.0.1")).toBe(true);
    expect(isPrivateOrLocalHost("169.254.169.254")).toBe(true);
    expect(
      assertSafeEvolutionMediaUrl({
        candidateUrl: "http://127.0.0.1/x",
        allowedBaseUrl: "https://evo.example.com"
      }).ok
    ).toBe(false);
  });

  it("bloqueia host diferente da base Evolution", () => {
    const r = assertSafeEvolutionMediaUrl({
      candidateUrl: "https://evil.example/file.jpg",
      allowedBaseUrl: "https://evo.example.com"
    });
    expect(r).toMatchObject({ ok: false, reason: "host_not_evolution_base" });
  });

  it("aceita URL na mesma origem Evolution", () => {
    const r = assertSafeEvolutionMediaUrl({
      candidateUrl: "https://evo.example.com/media/a.jpg",
      allowedBaseUrl: "https://evo.example.com"
    });
    expect(r.ok).toBe(true);
  });

  it("bloqueia protocolo não HTTP", () => {
    const r = assertSafeEvolutionMediaUrl({
      candidateUrl: "file:///etc/passwd",
      allowedBaseUrl: "https://evo.example.com"
    });
    expect(r.ok).toBe(false);
  });
});

describe("EvolutionMediaExtractor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("decodifica base64 inline", async () => {
    const payload = Buffer.from("hello-image").toString("base64");
    const media = await extractEvolutionMedia({
      whatsappId: 1,
      hints: {
        kind: "image",
        messageId: "M1",
        mimetype: "image/jpeg",
        filename: null,
        inlineBase64: payload
      }
    });
    expect(media.data.toString()).toBe("hello-image");
    expect(media.mimetype).toBe("image/jpeg");
    expect(getBase64).not.toHaveBeenCalled();
  });

  it("rejeita base64 inválido/vazio", () => {
    expect(() => decodeEvolutionBase64("", 1000)).toThrow(EvolutionHttpError);
  });

  it("rejeita arquivo acima do limite", () => {
    const max = maxBytesForEvolutionMediaKind("sticker");
    const big = Buffer.alloc(max + 10, 1).toString("base64");
    expect(() => decodeEvolutionBase64(big, max)).toThrow(/excede|TOO_LARGE/i);
  });

  it("usa getBase64 API quando sem inline/url", async () => {
    getBase64.mockResolvedValue({
      base64: Buffer.from("from-api").toString("base64"),
      mimetype: "audio/ogg"
    });
    const media = await extractEvolutionMedia({
      whatsappId: 9,
      hints: {
        kind: "audio",
        messageId: "AUD1",
        mimetype: null,
        filename: null
      }
    });
    expect(media.data.toString()).toBe("from-api");
    expect(getBase64).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: "AUD1", whatsappId: 9 })
    );
  });

  it("propaga timeout tipado da API", async () => {
    getBase64.mockRejectedValue(
      new EvolutionHttpError("ERR_EVOLUTION_MEDIA_TIMEOUT", "timeout")
    );
    await expect(
      extractEvolutionMedia({
        whatsappId: 1,
        hints: {
          kind: "image",
          messageId: "X",
          mimetype: "image/jpeg",
          filename: null
        }
      })
    ).rejects.toMatchObject({ code: "ERR_EVOLUTION_MEDIA_TIMEOUT" });
  });

  it("URL inválida/bloqueada via download helper", async () => {
    downloadUrl.mockRejectedValue(
      new EvolutionHttpError(
        "ERR_EVOLUTION_MEDIA_URL_BLOCKED",
        "URL de mídia bloqueada: private_or_local_host"
      )
    );
    await expect(
      extractEvolutionMedia({
        whatsappId: 1,
        hints: {
          kind: "image",
          messageId: "X",
          mimetype: "image/jpeg",
          filename: null,
          mediaUrl: "http://127.0.0.1/x"
        }
      })
    ).rejects.toMatchObject({ code: "ERR_EVOLUTION_MEDIA_URL_BLOCKED" });
  });
});

describe("sanitizeEvolutionWebhookPayload", () => {
  it("remove apikey e omite base64", () => {
    const sanitized = sanitizeEvolutionWebhookPayload({
      event: "MESSAGES_UPSERT",
      apikey: "SECRET",
      data: {
        message: {
          imageMessage: { base64: "AAAA", mimetype: "image/jpeg" }
        }
      }
    });
    expect(sanitized.apikey).toBeUndefined();
    const img = (sanitized.data as any).message.imageMessage;
    expect(img.base64).toBe("[omitted]");
    expect(img.mimetype).toBe("image/jpeg");
  });
});
