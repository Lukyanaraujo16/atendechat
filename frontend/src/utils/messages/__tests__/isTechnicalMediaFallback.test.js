/**
 * @jest-environment jsdom
 */
import {
  getDisplayableMessageBody,
  isTechnicalFilenameCaption,
} from "../isTechnicalMediaFallback";

function imageMessage(overrides = {}) {
  return {
    mediaType: "image",
    mediaUrl: "https://example.com/public/company/foto.png",
    body: "foto.png",
    isDeleted: false,
    fromMe: false,
    ...overrides,
  };
}

describe("getDisplayableMessageBody — imagem vs documento", () => {
  it("PNG sem caption → não usa filename como legenda", () => {
    expect(
      getDisplayableMessageBody(
        imageMessage({
          mediaUrl: "https://example.com/public/imagem.png",
          body: "imagem.png",
        })
      )
    ).toBeNull();
  });

  it("JPEG sem caption → não usa filename como legenda", () => {
    expect(
      getDisplayableMessageBody(
        imageMessage({
          mediaUrl: "https://example.com/public/foto.jpeg",
          body: "foto.jpeg",
        })
      )
    ).toBeNull();
  });

  it("JPG sem caption (extensão curta) → não usa filename como legenda", () => {
    expect(
      getDisplayableMessageBody(
        imageMessage({
          mediaUrl: "https://example.com/public/foto.jpg",
          body: "foto.jpg",
        })
      )
    ).toBeNull();
  });

  it("caption real contendo extensão permanece visível", () => {
    expect(
      getDisplayableMessageBody(
        imageMessage({ body: "Meu arquivo é foto.jpg" })
      )
    ).toBe("Meu arquivo é foto.jpg");

    expect(
      getDisplayableMessageBody(
        imageMessage({ body: "imagem.png enviada ontem" })
      )
    ).toBe("imagem.png enviada ontem");
  });

  it("PNG com caption real → imagem + caption", () => {
    expect(
      getDisplayableMessageBody(
        imageMessage({
          body: "Comprovante do pagamento",
        })
      )
    ).toBe("Comprovante do pagamento");
  });

  it("JPEG com caption real → imagem + caption", () => {
    expect(
      getDisplayableMessageBody(
        imageMessage({
          mediaUrl: "https://example.com/public/foto.jpeg",
          body: "Comprovante do pagamento",
        })
      )
    ).toBe("Comprovante do pagamento");
  });

  it("filename técnico gerado pelo WhatsApp não aparece como caption", () => {
    const body = "IMG-20250822-WA0123.jpg";
    const message = imageMessage({
      mediaUrl: `https://example.com/public/${body}`,
      body,
    });
    expect(isTechnicalFilenameCaption(body, message)).toBe(true);
    expect(getDisplayableMessageBody(message)).toBeNull();
  });

  it("basename da URL no body é tratado como filename técnico", () => {
    const message = imageMessage({
      mediaUrl: "https://example.com/public/uuid-file.png?token=1",
      body: "uuid-file.png",
    });
    expect(getDisplayableMessageBody(message)).toBeNull();
  });

  it("documento continua mostrando filename", () => {
    expect(
      getDisplayableMessageBody({
        mediaType: "application",
        mediaUrl: "https://example.com/public/contrato.pdf",
        body: "contrato.pdf",
      })
    ).toBe("contrato.pdf");

    expect(
      getDisplayableMessageBody({
        mediaType: "document",
        mediaUrl: "https://example.com/public/planilha.xlsx",
        body: "planilha.xlsx",
      })
    ).toBe("planilha.xlsx");
  });

  it("mensagem apagada preserva caption real e esconde filename técnico", () => {
    expect(
      getDisplayableMessageBody(
        imageMessage({
          isDeleted: true,
          body: "foto.png",
        })
      )
    ).toBeNull();

    expect(
      getDisplayableMessageBody(
        imageMessage({
          isDeleted: true,
          body: "Comprovante do pagamento",
        })
      )
    ).toBe("Comprovante do pagamento");

    expect(
      getDisplayableMessageBody({
        mediaType: "conversation",
        body: "olá",
        isDeleted: true,
      })
    ).toBe("olá");
  });

  it("vídeo sem caption não usa filename como legenda", () => {
    expect(
      getDisplayableMessageBody({
        mediaType: "video",
        mediaUrl: "https://example.com/public/clip.mp4",
        body: "clip.mp4",
      })
    ).toBeNull();
  });

  it("vídeo com caption digitado permanece visível", () => {
    expect(
      getDisplayableMessageBody({
        mediaType: "video",
        mediaUrl: "https://example.com/public/clip.mp4",
        body: "Reunião de ontem",
      })
    ).toBe("Reunião de ontem");
  });

  it("contactMessage/vcard não devolvem o vCard cru", () => {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Maria Silva",
      "TEL:+5527999999999",
      "END:VCARD",
    ].join("\n");

    expect(
      getDisplayableMessageBody({
        mediaType: "contactMessage",
        body: vcard,
      })
    ).toBeNull();

    expect(
      getDisplayableMessageBody({
        mediaType: "vcard",
        body: vcard,
      })
    ).toBeNull();
  });

  it("mensagem de texto comum continua visível", () => {
    expect(
      getDisplayableMessageBody({
        mediaType: "conversation",
        body: "olá, tudo bem?",
      })
    ).toBe("olá, tudo bem?");
  });
});
