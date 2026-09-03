import {
  assertSafeEvolutionMediaUrl,
  isPrivateOrLocalHost
} from "../evolutionUrlSafety";
import {
  collectEvolutionMediaHints,
  decodeEvolutionBase64,
  extractEvolutionMedia
} from "../EvolutionMediaExtractor";
import {
  EvolutionHttpError,
  evolutionDownloadMediaFromUrl,
  evolutionGetBase64FromMediaMessage
} from "../evolutionHttpClient";
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

  it("bloqueia CDN WhatsApp sem adicioná-la à allowlist", () => {
    const r = assertSafeEvolutionMediaUrl({
      candidateUrl: "https://mmg.whatsapp.net/v/t62.7118-24/example",
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

  it("URL WhatsApp CDN bloqueada pela SSRF cai no getBase64 autenticado", async () => {
    downloadUrl.mockRejectedValue(
      new EvolutionHttpError(
        "ERR_EVOLUTION_MEDIA_URL_BLOCKED",
        "URL de mídia bloqueada: host_not_evolution_base"
      )
    );
    getBase64.mockResolvedValue({
      base64: Buffer.from("from-evolution-api").toString("base64"),
      mimetype: "image/jpeg"
    });
    const media = await extractEvolutionMedia({
      whatsappId: 3,
      hints: {
        kind: "image",
        messageId: "3A5809589B19B293D6F5",
        mimetype: "image/jpeg",
        filename: null,
        mediaUrl: "https://mmg.whatsapp.net/v/t62.7118-24/example"
      }
    });
    expect(media.data.toString()).toBe("from-evolution-api");
    expect(media.mimetype).toBe("image/jpeg");
    expect(media.kind).toBe("image");
    expect(downloadUrl).toHaveBeenCalledTimes(1);
    expect(getBase64).toHaveBeenCalledWith({
      whatsappId: 3,
      messageId: "3A5809589B19B293D6F5",
      convertToMp4: false
    });
  });

  it("URL Evolution allowlisted que falha no download não esconde o erro", async () => {
    downloadUrl.mockRejectedValue(
      new EvolutionHttpError("ERR_EVOLUTION_MEDIA_TIMEOUT", "timeout")
    );
    await expect(
      extractEvolutionMedia({
        whatsappId: 1,
        hints: {
          kind: "image",
          messageId: "X",
          mimetype: "image/jpeg",
          filename: null,
          mediaUrl: "https://evo.example.com/media/a.jpg"
        }
      })
    ).rejects.toMatchObject({ code: "ERR_EVOLUTION_MEDIA_TIMEOUT" });
    expect(getBase64).not.toHaveBeenCalled();
  });

  it("sem inline e sem URL elegível, falha da API permanece terminal", async () => {
    downloadUrl.mockRejectedValue(
      new EvolutionHttpError(
        "ERR_EVOLUTION_MEDIA_URL_BLOCKED",
        "URL de mídia bloqueada: host_not_evolution_base"
      )
    );
    getBase64.mockRejectedValue(
      new EvolutionHttpError("ERR_EVOLUTION_MEDIA_EMPTY", "vazio")
    );
    await expect(
      extractEvolutionMedia({
        whatsappId: 1,
        hints: {
          kind: "image",
          messageId: "3A71C3A0FA75C93CE4D3",
          mimetype: "image/jpeg",
          filename: null,
          mediaUrl: "https://mmg.whatsapp.net/v/t62.7118-24/example"
        }
      })
    ).rejects.toMatchObject({ code: "ERR_EVOLUTION_MEDIA_EMPTY" });
  });
});

describe("collectEvolutionMediaHints imageMessage real", () => {
  it("lê url HTTPS, ignora jpegThumbnail e não trata thumbnail como base64 inline", () => {
    const hints = collectEvolutionMediaHints({
      kind: "image",
      messageId: "3A5809589B19B293D6F5",
      mimetype: "image/jpeg",
      filename: null,
      messageNode: {
        url: "https://mmg.whatsapp.net/v/t62.7118-24/example",
        mimetype: "image/jpeg",
        jpegThumbnail: "thumbnail-not-full-image"
      }
    });
    expect(hints.mediaUrl).toBe(
      "https://mmg.whatsapp.net/v/t62.7118-24/example"
    );
    expect(hints.inlineBase64).toBeNull();
    expect(hints.messageId).toBe("3A5809589B19B293D6F5");
    expect(hints.mimetype).toBe("image/jpeg");
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
