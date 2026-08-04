/**
 * Fase 2.17 — Multimodal AI Agent (áudio/imagem).
 */
import fs from "fs";
import os from "os";
import path from "path";

jest.mock("../../../libs/cache", () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(1),
  setNx: jest.fn().mockResolvedValue(true)
}));

jest.mock("../../OpenAi/OpenAiManager", () => ({
  executeOpenAiTranscription: jest.fn()
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn()
  }
}));

import Message from "../../../models/Message";
import { executeOpenAiTranscription } from "../../OpenAi/OpenAiManager";
import {
  resolveAiModelMediaCapabilities,
  buildAiAgentMediaReadiness
} from "../../../config/aiModelMediaCapabilities";
import {
  resolveAiAgentLocalMediaPath,
  guessMimeFromFilename,
  resolveWhisperUploadFilename
} from "../resolveAiAgentLocalMediaPath";
import TranscribeAiAgentAudioService from "../TranscribeAiAgentAudioService";
import { prepareAiAgentMultimodalTurn } from "../prepareAiAgentMultimodalTurn";
import { buildOpenAiMultimodalMessages } from "../../AiProviderService/aiProviderMultimodal";
import { AI_AGENT_AUDIO_FALLBACK_MESSAGE } from "../aiAgentInputContent";
import { get } from "../../../libs/cache";
import {
  normalizeAiAgentMediaMimeType,
  isAllowedAiAgentAudioMime
} from "../../../config/aiModelMediaCapabilities";

const mockedTranscribe = executeOpenAiTranscription as jest.Mock;
const mockedMessageFind = Message.findOne as jest.Mock;
const mockedGet = get as jest.Mock;

describe("AiAgent multimodal 2.17", () => {
  let tmpDir: string;
  let audioPath: string;
  let imagePath: string;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue(null);
    mockedMessageFind.mockReset();
    mockedTranscribe.mockReset();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-agent-media-"));
    audioPath = path.join(tmpDir, "voice.ogg");
    imagePath = path.join(tmpDir, "photo.jpg");
    fs.writeFileSync(audioPath, Buffer.from("fake-ogg-bytes"));
    fs.writeFileSync(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function writePublicFixture(filename: string, data: Buffer): {
    rel: string;
    abs: string;
  } {
    const publicRoot = path.resolve(__dirname, "../../../../public");
    fs.mkdirSync(publicRoot, { recursive: true });
    const rel = filename;
    const abs = path.join(publicRoot, rel);
    fs.writeFileSync(abs, data);
    return { rel, abs };
  }

  describe("capability registry", () => {
    it("gpt-4o-mini tem texto, visão e transcrição", () => {
      const caps = resolveAiModelMediaCapabilities("openai", "gpt-4o-mini");
      expect(caps.supportsText).toBe(true);
      expect(caps.supportsVision).toBe(true);
      expect(caps.supportsAudioTranscription).toBe(true);
    });

    it("gpt-3.5-turbo-1106 não tem visão", () => {
      const caps = resolveAiModelMediaCapabilities(
        "openai",
        "gpt-3.5-turbo-1106"
      );
      expect(caps.supportsVision).toBe(false);
      expect(caps.supportsAudioTranscription).toBe(true);
    });

    it("gemini flash tem visão e transcrição", () => {
      const caps = resolveAiModelMediaCapabilities(
        "gemini",
        "gemini-2.5-flash"
      );
      expect(caps.supportsVision).toBe(true);
      expect(caps.supportsAudioTranscription).toBe(true);
    });

    it("readiness distingue visão indisponível sem bloquear texto", () => {
      const r = buildAiAgentMediaReadiness({
        provider: "openai",
        model: "gpt-3.5-turbo-1106",
        hasCredential: true
      });
      expect(r.text).toBe("ready");
      expect(r.vision).toBe("unavailable");
      expect(r.audioTranscription).toBe("ready");
    });
  });

  describe("resolveAiAgentLocalMediaPath", () => {
    it("bloqueia path traversal", () => {
      expect(resolveAiAgentLocalMediaPath("../etc/passwd")).toBeNull();
      expect(resolveAiAgentLocalMediaPath("/etc/passwd")).toBeNull();
    });

    it("bloqueia URL arbitrária sem /public/", () => {
      expect(
        resolveAiAgentLocalMediaPath("https://evil.example/audio.ogg")
      ).toBeNull();
    });

    it("aceita relativo sob public", () => {
      const resolved = resolveAiAgentLocalMediaPath("company1/voice.ogg");
      expect(resolved).toBeTruthy();
      expect(resolved!.includes("..")).toBe(false);
    });

    it("guess mime", () => {
      expect(guessMimeFromFilename("a.ogg", "audio")).toBe("audio/ogg");
      expect(guessMimeFromFilename("a.oga", "audio")).toBe("audio/ogg");
      expect(guessMimeFromFilename("a.weba", "audio")).toBe("audio/webm");
      expect(guessMimeFromFilename("a.jpg", "image")).toBe("image/jpeg");
      expect(guessMimeFromFilename("a.webp", "image")).toBe("image/webp");
    });

    it("normaliza MIME com codecs e aliases do WhatsApp", () => {
      expect(normalizeAiAgentMediaMimeType("audio/ogg; codecs=opus")).toBe(
        "audio/ogg"
      );
      expect(
        normalizeAiAgentMediaMimeType("audio/mp4; codecs=mp4a.40.2")
      ).toBe("audio/mp4");
      expect(normalizeAiAgentMediaMimeType("application/ogg")).toBe(
        "audio/ogg"
      );
      expect(normalizeAiAgentMediaMimeType("audio/opus")).toBe("audio/ogg");
      expect(isAllowedAiAgentAudioMime("audio/ogg; codecs=opus")).toBe(true);
      expect(isAllowedAiAgentAudioMime("application/ogg")).toBe(true);
      expect(isAllowedAiAgentAudioMime("application/pdf")).toBe(false);
    });

    it("Whisper filename cobre .oga e extensão desconhecida", () => {
      expect(resolveWhisperUploadFilename("/tmp/123.oga", "audio/ogg")).toBe(
        "123.oga"
      );
      expect(
        resolveWhisperUploadFilename("/tmp/123.false", "audio/ogg; codecs=opus")
      ).toBe("audio.ogg");
    });
  });

  describe("TranscribeAiAgentAudioService", () => {
    it("transcreve áudio OpenAI válido", async () => {
      mockedTranscribe.mockResolvedValue({
        ok: true,
        text: "  Qual é o horário de atendimento?  ",
        tokensUsed: 0
      });

      const result = await TranscribeAiAgentAudioService({
        companyId: 10,
        ticketId: 20,
        agentId: 30,
        messageId: "MSG1",
        absolutePath: audioPath,
        mimeType: "audio/ogg",
        byteSize: fs.statSync(audioPath).size,
        provider: "openai",
        apiKey: "sk-test",
        model: "gpt-4o-mini"
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.text).toBe("Qual é o horário de atendimento?");
        expect(result.cached).toBe(false);
      }
    });

    it("rejeita formato não suportado", async () => {
      const result = await TranscribeAiAgentAudioService({
        companyId: 1,
        messageId: "MSG2",
        absolutePath: audioPath,
        mimeType: "application/pdf",
        byteSize: 10,
        provider: "openai",
        apiKey: "sk-test",
        model: "gpt-4o-mini"
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.errorCode).toBe("format_unsupported");
      }
    });

    it("rejeita arquivo grande", async () => {
      const result = await TranscribeAiAgentAudioService({
        companyId: 1,
        messageId: "MSG3",
        absolutePath: audioPath,
        mimeType: "audio/ogg",
        byteSize: 30 * 1024 * 1024,
        provider: "openai",
        apiKey: "sk-test",
        model: "gpt-4o-mini"
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.errorCode).toBe("file_too_large");
      }
    });

    it("usa cache Redis (idempotência)", async () => {
      mockedGet.mockResolvedValueOnce("Horário de atendimento");
      const result = await TranscribeAiAgentAudioService({
        companyId: 1,
        messageId: "MSG4",
        absolutePath: audioPath,
        mimeType: "audio/ogg",
        byteSize: 12,
        provider: "openai",
        apiKey: "sk-test",
        model: "gpt-4o-mini"
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.cached).toBe(true);
        expect(result.text).toBe("Horário de atendimento");
      }
      expect(mockedTranscribe).not.toHaveBeenCalled();
    });

    it("transcrição vazia falha", async () => {
      mockedTranscribe.mockResolvedValue({
        ok: true,
        text: "   ",
        tokensUsed: 0
      });
      expect(fs.existsSync(audioPath)).toBe(true);
      const result = await TranscribeAiAgentAudioService({
        companyId: 1,
        messageId: "MSG5",
        absolutePath: audioPath,
        mimeType: "audio/ogg",
        byteSize: fs.statSync(audioPath).size,
        provider: "openai",
        apiKey: "sk-test",
        model: "gpt-4o-mini"
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.errorCode).toBe("empty_transcription");
      }
    });

    it("provider indisponível", async () => {
      mockedTranscribe.mockResolvedValue({
        ok: false,
        error: "OPENAI_API_ERROR"
      });
      const result = await TranscribeAiAgentAudioService({
        companyId: 1,
        messageId: "MSG6",
        absolutePath: audioPath,
        mimeType: "audio/ogg",
        byteSize: 12,
        provider: "openai",
        apiKey: "sk-test",
        model: "gpt-4o-mini"
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.errorCode).toBe("provider_unavailable");
      }
    });
  });

  describe("prepareAiAgentMultimodalTurn", () => {
    it("áudio → contexto com transcrição", async () => {
      mockedTranscribe.mockResolvedValue({
        ok: true,
        text: "Qual é o horário de atendimento?",
        tokensUsed: 0
      });
      const fixture = writePublicFixture(
        `_test_audio_${Date.now()}.ogg`,
        Buffer.from("ogg")
      );
      mockedMessageFind.mockResolvedValue({
        id: "A1",
        mediaType: "audio",
        body: "Áudio",
        getDataValue: () => fixture.rel
      });

      try {
        const prepared = await prepareAiAgentMultimodalTurn({
          companyId: 1,
          ticketId: 2,
          agentId: 3,
          messageId: "A1",
          inboundText: "Áudio",
          classification: {
            messageType: "audio",
            hasText: false,
            hasMedia: true,
            baileysType: "audioMessage"
          },
          provider: "openai",
          apiKey: "sk-test",
          model: "gpt-4o-mini"
        });

        expect(prepared.ok).toBe(true);
        if (prepared.ok) {
          expect(prepared.knowledgeQuery).toContain("horário");
          expect(prepared.turn.inboundText).toContain("Conteúdo compreendido");
          expect(prepared.turn.transcription).toBe(
            "Qual é o horário de atendimento?"
          );
        }
      } finally {
        try {
          fs.unlinkSync(fixture.abs);
        } catch {
          // ignore
        }
      }
    });

    it("áudio .oga (extensão real mime-types/WhatsApp) transcreve", async () => {
      mockedTranscribe.mockResolvedValue({
        ok: true,
        text: "Quero remarcar minha consulta",
        tokensUsed: 0
      });
      const fixture = writePublicFixture(
        `_test_audio_${Date.now()}.oga`,
        Buffer.from("OggS")
      );
      mockedMessageFind.mockResolvedValue({
        id: "A-OGA",
        mediaType: "audio",
        body: "Áudio",
        getDataValue: () => fixture.rel
      });

      try {
        const prepared = await prepareAiAgentMultimodalTurn({
          companyId: 1,
          ticketId: 2,
          agentId: 3,
          messageId: "A-OGA",
          inboundText: "Áudio",
          classification: {
            messageType: "audio",
            hasText: false,
            hasMedia: true,
            baileysType: "audioMessage"
          },
          provider: "openai",
          apiKey: "sk-test",
          model: "gpt-4o-mini"
        });
        expect(prepared.ok).toBe(true);
        if (prepared.ok) {
          expect(prepared.turn.transcription).toContain("remarcar");
        }
        expect(mockedTranscribe).toHaveBeenCalled();
      } finally {
        try {
          fs.unlinkSync(fixture.abs);
        } catch {
          // ignore
        }
      }
    });

    it("imagem JPEG com visão", async () => {
      const fixture = writePublicFixture(
        `_test_img_${Date.now()}.jpg`,
        Buffer.from([0xff, 0xd8, 0xff, 0xd9])
      );
      mockedMessageFind.mockResolvedValue({
        id: "I1",
        mediaType: "image",
        body: "Vocês têm esse modelo?",
        getDataValue: () => fixture.rel
      });

      try {
        const prepared = await prepareAiAgentMultimodalTurn({
          companyId: 1,
          ticketId: 2,
          agentId: 3,
          messageId: "I1",
          inboundText: "Vocês têm esse modelo?",
          classification: {
            messageType: "image",
            hasText: true,
            hasMedia: true,
            baileysType: "imageMessage"
          },
          provider: "openai",
          apiKey: "sk-test",
          model: "gpt-4o-mini"
        });
        expect(prepared.ok).toBe(true);
        if (prepared.ok) {
          expect(prepared.turn.imageParts).toHaveLength(1);
          expect(prepared.turn.imageParts[0].mimeType).toBe("image/jpeg");
          expect(prepared.knowledgeQuery).toContain("modelo");
        }
      } finally {
        try {
          fs.unlinkSync(fixture.abs);
        } catch {
          // ignore
        }
      }
    });

    it("modelo sem visão → fallback controlado sem imagem", async () => {
      mockedMessageFind.mockResolvedValue({
        id: "I2",
        mediaType: "image",
        body: "",
        getDataValue: () => "x.jpg"
      });
      const prepared = await prepareAiAgentMultimodalTurn({
        companyId: 1,
        ticketId: 2,
        agentId: 3,
        messageId: "I2",
        inboundText: "",
        classification: {
          messageType: "image",
          hasText: false,
          hasMedia: true,
          baileysType: "imageMessage"
        },
        provider: "openai",
        apiKey: "sk-test",
        model: "gpt-3.5-turbo-1106"
      });
      expect(prepared.ok).toBe(false);
      if (prepared.ok === false) {
        expect(prepared.errorCode).toBe("vision_not_supported");
        expect(prepared.askRetry).toBe(false);
      }
    });

    it("falha de áudio retorna mensagem natural", async () => {
      mockedMessageFind.mockResolvedValue(null);
      const prepared = await prepareAiAgentMultimodalTurn({
        companyId: 1,
        ticketId: 2,
        agentId: 3,
        messageId: "missing",
        inboundText: "Áudio",
        classification: {
          messageType: "audio",
          hasText: false,
          hasMedia: true,
          baileysType: "audioMessage"
        },
        provider: "openai",
        apiKey: "sk-test",
        model: "gpt-4o-mini"
      });
      expect(prepared.ok).toBe(false);
      if (prepared.ok === false) {
        expect(prepared.clientFallbackMessage).toBe(
          AI_AGENT_AUDIO_FALLBACK_MESSAGE
        );
      }
    });
  });

  describe("OpenAI multimodal message builder", () => {
    it("anexa image_url na última user message", () => {
      const messages = buildOpenAiMultimodalMessages(
        [{ role: "user", content: "Vocês têm esse modelo?" }],
        [{ mimeType: "image/png", base64: "AAAA" }]
      );
      const content = messages[0].content as unknown as Array<{
        type: string;
        image_url?: { url: string };
      }>;
      expect(Array.isArray(content)).toBe(true);
      expect(content.some(p => p.type === "image_url")).toBe(true);
      expect(content.find(p => p.type === "image_url")!.image_url!.url).toContain(
        "data:image/png;base64,AAAA"
      );
    });
  });

  describe("tenant isolation de Message", () => {
    it("prepare busca Message com companyId e ticketId", async () => {
      mockedMessageFind.mockResolvedValue(null);
      await prepareAiAgentMultimodalTurn({
        companyId: 99,
        ticketId: 88,
        agentId: 1,
        messageId: "X",
        inboundText: "Áudio",
        classification: {
          messageType: "audio",
          hasText: false,
          hasMedia: true,
          baileysType: "audioMessage"
        },
        provider: "openai",
        apiKey: "sk",
        model: "gpt-4o-mini"
      });
      expect(mockedMessageFind).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "X", companyId: 99, ticketId: 88 }
        })
      );
    });
  });
});
