import {
  INTERNAL_CHAT_PUSH_TITLE,
  buildInternalChatPushBody,
  buildInternalChatTargetUrl,
  truncatePushPreview
} from "../internalChatPushContent";

describe("internalChatPushContent", () => {
  it("usa título comercial fixo", () => {
    expect(INTERNAL_CHAT_PUSH_TITLE).toBe("Nova mensagem no chat interno");
  });

  it("monta prévia de texto com remetente", () => {
    expect(
      buildInternalChatPushBody({
        senderName: "Ana",
        messageText: "Olá, tudo bem?"
      })
    ).toBe("Ana: Olá, tudo bem?");
  });

  it("trunca prévia longa e remove quebras", () => {
    const long = `${"a".repeat(200)}\n\nlinha`;
    const body = buildInternalChatPushBody({
      senderName: "Ana",
      messageText: long
    });
    expect(body.startsWith("Ana: ")).toBe(true);
    expect(body.length).toBeLessThan(160);
    expect(body).toContain("…");
    expect(body).not.toContain("\n");
  });

  it("fallback sem texto", () => {
    expect(
      buildInternalChatPushBody({ senderName: "Ana", messageText: "   " })
    ).toBe("Ana: Nova mensagem");
  });

  it("labels de mídia", () => {
    expect(
      buildInternalChatPushBody({
        senderName: "Ana",
        messageText: "",
        mediaType: "image"
      })
    ).toBe("Ana: Enviou uma imagem");
    expect(
      buildInternalChatPushBody({
        senderName: "Ana",
        mediaType: "audio"
      })
    ).toBe("Ana: Enviou um áudio");
    expect(
      buildInternalChatPushBody({
        senderName: "Ana",
        mediaType: "video"
      })
    ).toBe("Ana: Enviou um vídeo");
    expect(
      buildInternalChatPushBody({
        senderName: "Ana",
        mediaType: "document"
      })
    ).toBe("Ana: Enviou um arquivo");
  });

  it("preserva acentos", () => {
    expect(
      buildInternalChatPushBody({
        senderName: "José",
        messageText: "ação necessária"
      })
    ).toBe("José: ação necessária");
  });

  it("deep link prefere uuid", () => {
    expect(buildInternalChatTargetUrl("chat-uuid-1", 9)).toBe(
      "/chats/chat-uuid-1"
    );
    expect(buildInternalChatTargetUrl(null, 9)).toBe("/chats/9");
  });

  it("truncate helper", () => {
    expect(truncatePushPreview("  oi  ")).toBe("oi");
    expect(truncatePushPreview("x".repeat(5), 4)).toBe("xxx…");
  });
});
