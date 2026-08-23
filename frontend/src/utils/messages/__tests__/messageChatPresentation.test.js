/**
 * @jest-environment jsdom
 */
import {
  getMessageBubblePresentation,
  shouldRenderChatMedia,
  shouldShowMessageActionMenu,
  shouldUseImageLightbox,
} from "../messageChatPresentation";

const createdAt = "2026-08-22T12:00:00.000Z";

function imageMessage(overrides = {}) {
  return {
    id: "img-1",
    mediaType: "image",
    mediaUrl: "https://example.com/public/foto.png",
    body: "foto.png",
    isDeleted: false,
    fromMe: false,
    createdAt,
    ...overrides,
  };
}

describe("apresentação do balão de mídia", () => {
  it("PNG/JPEG válidos usam lightbox e não o menu desabilitado", () => {
    const png = getMessageBubblePresentation(imageMessage());
    expect(png.showMedia).toBe(true);
    expect(png.useImageLightbox).toBe(true);
    expect(png.showActionMenu).toBe(true);
    expect(png.showTombstone).toBe(false);
    expect(png.displayBody).toBeNull();

    const jpeg = getMessageBubblePresentation(
      imageMessage({
        mediaUrl: "https://example.com/public/foto.jpeg",
        body: "foto.jpeg",
      })
    );
    expect(jpeg.useImageLightbox).toBe(true);
    expect(jpeg.displayBody).toBeNull();
  });

  it("PNG/JPEG com caption real expõem a caption e o lightbox", () => {
    const png = getMessageBubblePresentation(
      imageMessage({ body: "Comprovante do pagamento" })
    );
    expect(png.useImageLightbox).toBe(true);
    expect(png.displayBody).toBe("Comprovante do pagamento");

    const jpeg = getMessageBubblePresentation(
      imageMessage({
        mediaUrl: "https://example.com/public/foto.jpg",
        body: "Comprovante do pagamento",
      })
    );
    expect(jpeg.useImageLightbox).toBe(true);
    expect(jpeg.displayBody).toBe("Comprovante do pagamento");
  });

  it("message.isDeleted → sem mídia, sem filename, sem menu, com tombstone (inbound e outbound)", () => {
    const inboundMessage = imageMessage({
      isDeleted: true,
      fromMe: false,
      body: "imagem.png",
    });
    const outboundMessage = imageMessage({
      isDeleted: true,
      fromMe: true,
      body: "foto.jpeg",
    });
    const inbound = getMessageBubblePresentation(inboundMessage);
    const outbound = getMessageBubblePresentation(outboundMessage);

    [inbound, outbound].forEach((plan) => {
      expect(plan.deleted).toBe(true);
      expect(plan.showTombstone).toBe(true);
      expect(plan.showMedia).toBe(false);
      expect(plan.useImageLightbox).toBe(false);
      expect(plan.showActionMenu).toBe(false);
      expect(plan.showQuoted).toBe(false);
      expect(plan.displayBody).toBeNull();
    });

    expect(shouldRenderChatMedia(inboundMessage)).toBe(false);
    expect(shouldUseImageLightbox(outboundMessage)).toBe(false);
    expect(shouldShowMessageActionMenu(inboundMessage)).toBe(false);
  });

  it("texto apagado usa o mesmo isDeleted", () => {
    const plan = getMessageBubblePresentation({
      id: "txt-1",
      mediaType: "conversation",
      body: "olá",
      isDeleted: true,
      fromMe: false,
      createdAt,
    });
    expect(plan.showTombstone).toBe(true);
    expect(plan.showActionMenu).toBe(false);
    expect(plan.displayBody).toBeNull();
    expect(plan.showMedia).toBe(false);
  });

  it("mensagem viva continua com menu de Reply/Delete (trigger visível)", () => {
    const message = imageMessage({
      fromMe: true,
      body: "Comprovante do pagamento",
    });
    const live = getMessageBubblePresentation(message);
    expect(live.showActionMenu).toBe(true);
    expect(shouldShowMessageActionMenu(message)).toBe(true);
  });

  it("documento não entra na regra de esconder filename", () => {
    const plan = getMessageBubblePresentation({
      id: "doc-1",
      mediaType: "application",
      mediaUrl: "https://example.com/public/contrato.pdf",
      body: "contrato.pdf",
      isDeleted: false,
      fromMe: false,
      createdAt,
    });
    expect(plan.showMedia).toBe(true);
    expect(plan.useImageLightbox).toBe(false);
    expect(plan.displayBody).toBe("contrato.pdf");
    expect(plan.showActionMenu).toBe(true);
  });
});
