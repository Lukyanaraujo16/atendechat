/**
 * Fase 2.20.1 — Processamento real de áudio WhatsApp.
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

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    post: jest.fn()
  }
}));

jest.mock("../../../models/OpenAiUsage", () => ({
  __esModule: true,
  default: {
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue({})
  }
}));

import axios from "axios";
import {
  coerceWhatsAppMediaBuffer,
  inspectAiAgentAudioFile
} from "../inspectAiAgentAudioFile";
import { executeOpenAiTranscription } from "../../OpenAi/OpenAiManager";
import TranscribeAiAgentAudioService from "../TranscribeAiAgentAudioService";
import { AI_AGENT_AUDIO_TECHNICAL_CODES } from "../aiAgentAudioTechnicalCodes";
import { resolveWhisperUploadFilename } from "../resolveAiAgentLocalMediaPath";
import { normalizeAiAgentMediaMimeType } from "../../../config/aiModelMediaCapabilities";

const mockedAxiosPost = axios.post as jest.Mock;

const FIXTURE = path.resolve(
  __dirname,
  "fixtures/sample-whatsapp-voice.ogg"
);

describe("AiAgent audio real processing 2.20.1", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxiosPost.mockReset();
  });

  describe("coerceWhatsAppMediaBuffer", () => {
    it("preserva Buffer binário sem decodificar base64", () => {
      const orig = Buffer.from([0x4f, 0x67, 0x67, 0x53, 0x00, 0xff]);
      const out = coerceWhatsAppMediaBuffer(orig);
      expect(out.equals(orig)).toBe(true);
    });

    it("aceita Uint8Array", () => {
      const u8 = Uint8Array.from([0x4f, 0x67, 0x67, 0x53]);
      expect(coerceWhatsAppMediaBuffer(u8).toString("ascii", 0, 4)).toBe(
        "OggS"
      );
    });
  });

  describe("inspectAiAgentAudioFile", () => {
    it("detecta magic bytes OGG da fixture", async () => {
      const inspection = await inspectAiAgentAudioFile({
        absolutePath: FIXTURE,
        mimeHint: "audio/ogg; codecs=opus"
      });
      expect(inspection.exists).toBe(true);
      expect(inspection.readable).toBe(true);
      expect(inspection.byteSize).toBeGreaterThan(0);
      expect(inspection.container).toBe("ogg");
      expect(inspection.magicHex.startsWith("4f676753")).toBe(true);
      expect(inspection.normalizedMimeType).toBe("audio/ogg");
    });

    it("marca ausente quando path inválido", async () => {
      const inspection = await inspectAiAgentAudioFile({
        absolutePath: path.join(os.tmpdir(), "missing-audio-xyz.ogg")
      });
      expect(inspection.exists).toBe(false);
      expect(inspection.readable).toBe(false);
    });
  });

  describe("OpenAI multipart real", () => {
    it("envia FormData com filename e NÃO quebra stream.path", async () => {
      mockedAxiosPost.mockImplementation(async (_url, form) => {
        // form-data stream ainda aponta para arquivo real
        expect(form).toBeTruthy();
        return { status: 200, data: { text: "olá, quero remarcar" } };
      });

      const filename = resolveWhisperUploadFilename(
        FIXTURE,
        "audio/ogg; codecs=opus"
      );
      expect(filename.endsWith(".ogg") || filename.endsWith(".oga")).toBe(true);

      const result = await executeOpenAiTranscription({
        companyId: 1,
        ticketId: 2,
        apiKey: "sk-test",
        absolutePath: FIXTURE,
        filename,
        mimeType: normalizeAiAgentMediaMimeType("audio/ogg; codecs=opus"),
        timeoutMs: 5000
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.text).toContain("remarcar");
      }
      expect(mockedAxiosPost).toHaveBeenCalledTimes(1);
      const [url, , config] = mockedAxiosPost.mock.calls[0];
      expect(url).toContain("/audio/transcriptions");
      expect(config.headers.Authorization).toMatch(/^Bearer /);
      expect(config.timeout).toBe(5000);
    });

    it("propaga HTTP 401 como auth", async () => {
      mockedAxiosPost.mockResolvedValue({
        status: 401,
        data: { error: { code: "invalid_api_key", type: "invalid_request_error" } }
      });
      const result = await executeOpenAiTranscription({
        companyId: 1,
        apiKey: "sk-bad",
        absolutePath: FIXTURE,
        filename: "voice.ogg",
        mimeType: "audio/ogg"
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.httpStatus).toBe(401);
        expect(result.errorStage).toBe("auth");
      }
    });

    it("propaga HTTP 415 como format", async () => {
      mockedAxiosPost.mockResolvedValue({
        status: 415,
        data: { error: { code: "unsupported_format" } }
      });
      const result = await executeOpenAiTranscription({
        companyId: 1,
        apiKey: "sk-test",
        absolutePath: FIXTURE,
        filename: "voice.ogg",
        mimeType: "audio/ogg"
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.httpStatus).toBe(415);
        expect(result.errorStage).toBe("format");
      }
    });

    it("não sobrescreve path com basename (regressão 2.20)", async () => {
      // Garante que createReadStream do absolutePath funciona via FormData options
      mockedAxiosPost.mockResolvedValue({
        status: 200,
        data: { text: "ok" }
      });
      const result = await executeOpenAiTranscription({
        companyId: 1,
        apiKey: "sk-test",
        absolutePath: FIXTURE,
        filename: "audio.ogg", // basename proposital
        mimeType: "audio/ogg"
      });
      expect(result.ok).toBe(true);
      // Se o bug do path override voltasse, axios nem seria chamado (ENOENT)
      expect(mockedAxiosPost).toHaveBeenCalled();
    });
  });

  describe("TranscribeAiAgentAudioService technical codes", () => {
    it("sucesso retorna audio_transcription_success", async () => {
      mockedAxiosPost.mockResolvedValue({
        status: 200,
        data: { text: "  horário de atendimento  " }
      });
      const result = await TranscribeAiAgentAudioService({
        companyId: 10,
        ticketId: 20,
        agentId: 30,
        messageId: "MSG-OK",
        absolutePath: FIXTURE,
        mimeType: "audio/ogg; codecs=opus",
        byteSize: fs.statSync(FIXTURE).size,
        provider: "openai",
        apiKey: "sk-test",
        model: "gpt-4o-mini"
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.text).toBe("horário de atendimento");
        expect(result.technicalCode).toBe(
          AI_AGENT_AUDIO_TECHNICAL_CODES.TRANSCRIPTION_SUCCESS
        );
      }
    });

    it("401 mapeia para auth failed", async () => {
      mockedAxiosPost.mockResolvedValue({
        status: 401,
        data: { error: { code: "invalid_api_key" } }
      });
      const result = await TranscribeAiAgentAudioService({
        companyId: 1,
        messageId: "MSG-401",
        absolutePath: FIXTURE,
        mimeType: "audio/ogg",
        byteSize: fs.statSync(FIXTURE).size,
        provider: "openai",
        apiKey: "sk-bad",
        model: "gpt-4o-mini"
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.technicalCode).toBe(
          AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_AUTH_FAILED
        );
        expect(result.httpStatus).toBe(401);
      }
    });

    it("arquivo ausente → audio_file_missing", async () => {
      const result = await TranscribeAiAgentAudioService({
        companyId: 1,
        messageId: "MSG-MISS",
        absolutePath: path.join(os.tmpdir(), "nope-audio.ogg"),
        mimeType: "audio/ogg",
        byteSize: 10,
        provider: "openai",
        apiKey: "sk-test",
        model: "gpt-4o-mini"
      });
      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.technicalCode).toBe(
          AI_AGENT_AUDIO_TECHNICAL_CODES.FILE_MISSING
        );
      }
      expect(mockedAxiosPost).not.toHaveBeenCalled();
    });
  });
});
