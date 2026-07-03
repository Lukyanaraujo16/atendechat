jest.mock("@whiskeysockets/baileys", () => ({
  getContentType: (message: Record<string, unknown> | null | undefined) => {
    if (!message) return undefined;
    if (message.conversation !== undefined) return "conversation";
    if (message.audioMessage) return "audioMessage";
    if (message.imageMessage) return "imageMessage";
    if (message.reactionMessage) return "reactionMessage";
    return undefined;
  },
  proto: {}
}));

import { proto } from "@whiskeysockets/baileys";
import { classifyInboundMessageFromBaileys } from "../classifyInboundMessage";
import { isFlowAutomationActive } from "../isFlowAutomationActive";
import { resolveInboundMessageId } from "../resolveInboundMessageId";
import { sanitizeAiAgentRuntimeMetadata } from "../sanitizeAiAgentRuntimeMetadata";
import Ticket from "../../../models/Ticket";

function ticket(partial: Partial<Ticket>): Ticket {
  return partial as Ticket;
}

describe("AiAgent hardening 1.2.1", () => {
  describe("resolveInboundMessageId", () => {
    it("prefere baileys id confiável", () => {
      expect(
        resolveInboundMessageId({
          baileysMessageId: "ABC123",
          persistedMessageId: "OTHER"
        })
      ).toEqual({ messageId: "ABC123", source: "baileys" });
    });

    it("rejeita fallback com Date.now", () => {
      expect(
        resolveInboundMessageId({
          baileysMessageId: "fallback-1-123456",
          persistedMessageId: null
        })
      ).toEqual({ messageId: null, source: "missing" });
    });

    it("usa persisted quando baileys ausente", () => {
      expect(
        resolveInboundMessageId({
          baileysMessageId: null,
          persistedMessageId: "PERSISTED1"
        })
      ).toEqual({ messageId: "PERSISTED1", source: "persisted" });
    });
  });

  describe("isFlowAutomationActive", () => {
    it("flowStopped sozinho não indica fluxo ativo", () => {
      const result = isFlowAutomationActive(
        ticket({
          flowStopped: "42",
          flowWebhook: false,
          lastFlowId: "node-1"
        })
      );
      expect(result.active).toBe(false);
    });

    it("flowWebhook true com flowStopped indica ativo", () => {
      const result = isFlowAutomationActive(
        ticket({
          flowStopped: "42",
          flowWebhook: true,
          lastFlowId: "node-1"
        })
      );
      expect(result.active).toBe(true);
      expect(result.reason).toBe("flow_webhook_active");
    });
  });

  describe("classifyInboundMessageFromBaileys", () => {
    it("texto válido não bloqueia", () => {
      const msg = {
        key: { id: "1" },
        message: { conversation: "Olá" }
      } as proto.IWebMessageInfo;
      const c = classifyInboundMessageFromBaileys(msg, "Olá");
      expect(c.messageType).toBe("text");
      expect(c.hasText).toBe(true);
      expect(c.blockReason).toBeUndefined();
    });

    it("áudio bloqueia com audio_not_supported", () => {
      const msg = {
        key: { id: "2" },
        message: { audioMessage: {} }
      } as proto.IWebMessageInfo;
      const c = classifyInboundMessageFromBaileys(msg, "Áudio");
      expect(c.messageType).toBe("audio");
      expect(c.blockReason).toBe("audio_not_supported");
    });

    it("imagem sem legenda bloqueia com media_not_supported", () => {
      const msg = {
        key: { id: "3" },
        message: { imageMessage: {} }
      } as proto.IWebMessageInfo;
      const c = classifyInboundMessageFromBaileys(msg, null);
      expect(c.blockReason).toBe("media_not_supported");
    });

    it("imagem com legenda permite avaliação da legenda", () => {
      const msg = {
        key: { id: "4" },
        message: { imageMessage: { caption: "Preciso de ajuda" } }
      } as proto.IWebMessageInfo;
      const c = classifyInboundMessageFromBaileys(msg, null);
      expect(c.hasText).toBe(true);
      expect(c.blockReason).toBeUndefined();
    });

    it("reação bloqueia com unsupported_message_type", () => {
      const msg = {
        key: { id: "5" },
        message: { reactionMessage: { text: "👍" } }
      } as proto.IWebMessageInfo;
      const c = classifyInboundMessageFromBaileys(msg, "reaction");
      expect(c.blockReason).toBe("unsupported_message_type");
    });
  });

  describe("sanitizeAiAgentRuntimeMetadata", () => {
    it("remove campos sensíveis e mantém permitidos", () => {
      const out = sanitizeAiAgentRuntimeMetadata({
        messageType: "text",
        hasText: true,
        body: "segredo",
        phone: "5511999999999",
        token: "abc",
        evaluatorVersion: "old"
      });
      expect(out.messageType).toBe("text");
      expect(out.hasText).toBe(true);
      expect(out.body).toBeUndefined();
      expect(out.phone).toBeUndefined();
      expect(out.token).toBeUndefined();
      expect(out.evaluatorVersion).toBe("1.2.1");
    });
  });
});
