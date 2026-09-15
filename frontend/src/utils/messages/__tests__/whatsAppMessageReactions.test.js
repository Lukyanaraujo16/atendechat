/**
 * @jest-environment jsdom
 */
import {
  getWhatsAppMessageReactions,
  getWhatsAppReactionEmojis,
  isWhatsAppReactionTimelineItem,
} from "../whatsAppMessageReactions";

describe("whatsAppMessageReactions", () => {
  it("reactionMessage WhatsApp não é balão de timeline", () => {
    expect(
      isWhatsAppReactionTimelineItem({
        mediaType: "reactionMessage",
        channel: "whatsapp",
        body: "😂",
      })
    ).toBe(true);
  });

  it("Instagram reaction não é filtrado como WhatsApp", () => {
    expect(
      isWhatsAppReactionTimelineItem({
        mediaType: "reaction",
        channel: "instagram",
        body: "❤️",
      })
    ).toBe(false);
  });

  it("lê reações persistidas no metaPayload", () => {
    const message = {
      id: "TARGET1",
      body: "Teste de mensagem",
      channel: "whatsapp",
      metaPayload: {
        whatsappReactions: [
          {
            emoji: "😂",
            fromMe: false,
            reactorMessageId: "R1",
            reactorKey: "peer",
          },
        ],
      },
    };
    expect(getWhatsAppReactionEmojis(message)).toEqual(["😂"]);
  });

  it("hidrata reação legado pelo quotedMsgId", () => {
    const target = { id: "TARGET1", body: "Teste de mensagem" };
    const list = [
      target,
      {
        id: "R-legacy",
        mediaType: "reactionMessage",
        quotedMsgId: "TARGET1",
        body: "😂",
        fromMe: false,
        channel: "whatsapp",
      },
    ];
    expect(getWhatsAppReactionEmojis(target, list)).toEqual(["😂"]);
  });

  it("mensagem comum não ganha reação", () => {
    expect(
      getWhatsAppMessageReactions({
        id: "T",
        body: "oi",
        mediaType: "conversation",
      })
    ).toEqual([]);
  });
});
