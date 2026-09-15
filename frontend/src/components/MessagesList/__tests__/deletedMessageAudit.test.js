/**
 * @jest-environment jsdom
 *
 * isDeleted é estado visual adicional: indicador + conteúdo original.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";

import MessagesList from "../index";
import { SocketContext } from "../../../context/Socket/SocketContext";
import { AuthContext } from "../../../context/Auth/AuthContext";
import { ReplyMessageContext } from "../../../context/ReplyingMessage/ReplyingMessageContext";
import { getThemeOptions } from "../../../theme/appThemeOptions";
import api from "../../../services/api";

global.MutationObserver = class {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("../../../errors/toastError", () => jest.fn());

jest.mock("../../../hooks/useStickers", () => ({
  __esModule: true,
  default: () => ({ saveStickerFromMessage: jest.fn() }),
}));

jest.mock("../../ModalImageCors", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: function ModalImageCorsMock({ imageUrl }) {
      return React.createElement("img", {
        "data-testid": "chat-lightbox-image",
        alt: "image",
        src: imageUrl,
      });
    },
  };
});

const createdAt = "2026-08-22T12:00:00.000Z";
const EVOLUTION_MAPS =
  "https://maps.google.com/maps?q=-20.370664596557617%2C-40.34754943847656&z=17&hl=pt-BR";
const COORDS = "-20.370664596557617, -40.34754943847656";
const VIDEO_URL = "https://example.com/public/company/clip.mp4";
const AUDIO_URL = "https://example.com/public/company/ptt.ogg";
const DOC_URL = "https://example.com/public/contrato.pdf";
const VCARD = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:Maria Silva",
  "TEL:+5527999999999",
  "END:VCARD",
].join("\n");

function baseMessage(overrides = {}) {
  return {
    ticketId: 1,
    fromMe: false,
    isDeleted: true,
    createdAt,
    ack: 0,
    channel: "whatsapp",
    ...overrides,
  };
}

function renderList(messages) {
  const theme = createTheme({ ...getThemeOptions("light"), mode: "light" });
  const socket = { on: jest.fn(), off: jest.fn(), emit: jest.fn() };
  api.get.mockImplementation((url) => {
    if (String(url).startsWith("/messages/")) {
      return Promise.resolve({ data: { messages, hasMore: false } });
    }
    return Promise.resolve({ data: { stickers: [] } });
  });

  return render(
    <ThemeProvider theme={theme}>
      <SocketContext.Provider value={{ getSocket: () => socket }}>
        <AuthContext.Provider value={{ user: { profile: "user" } }}>
          <ReplyMessageContext.Provider
            value={{ setReplyingMessage: jest.fn(), replyingMessage: null }}
          >
            <MessagesList ticket={{ id: 1, channel: "whatsapp" }} ticketId={1} />
          </ReplyMessageContext.Provider>
        </AuthContext.Provider>
      </SocketContext.Provider>
    </ThemeProvider>
  );
}

describe("MessagesList — auditoria de mensagem apagada", () => {
  let openSpy;

  beforeEach(() => {
    localStorage.setItem("companyId", "1");
    localStorage.setItem("i18nextLng", "pt");
    api.get.mockReset();
    openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it("texto vivo continua igual, sem indicador", async () => {
    renderList([
      baseMessage({
        id: "live-text",
        mediaType: "conversation",
        body: "Contrato fechado nos 33mil",
        isDeleted: false,
      }),
    ]);

    expect(await screen.findByText("Contrato fechado nos 33mil")).toBeTruthy();
    expect(screen.queryByTestId("deleted-message-tombstone")).toBeNull();
  });

  it("texto apagado mostra indicador acima do body original", async () => {
    const { container } = renderList([
      baseMessage({
        id: "del-text",
        mediaType: "conversation",
        body: "Contrato fechado nos 33mil",
      }),
    ]);

    const body = await screen.findByText("Contrato fechado nos 33mil");
    const banner = screen.getByTestId("deleted-message-tombstone");
    expect(banner.textContent).toContain("Mensagem apagada pelo contato");
    expect(
      banner.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(container.querySelector("#messageActionsButton")).toBeNull();
  });

  it("imagem apagada mantém lightbox e caption", async () => {
    renderList([
      baseMessage({
        id: "del-img",
        mediaType: "image",
        mediaUrl: "https://example.com/public/apagada.png",
        body: "Comprovante do pagamento",
      }),
    ]);

    expect(await screen.findByText("Comprovante do pagamento")).toBeTruthy();
    expect(screen.getByTestId("deleted-message-tombstone").textContent).toContain(
      "Mensagem apagada pelo contato"
    );
    expect(screen.getByTestId("chat-lightbox-image").getAttribute("src")).toBe(
      "https://example.com/public/apagada.png"
    );
  });

  it("vídeo apagado mantém player, download e caption", async () => {
    renderList([
      baseMessage({
        id: "del-vid",
        mediaType: "video",
        mediaUrl: VIDEO_URL,
        body: "Reunião de ontem",
      }),
    ]);

    const wrap = await screen.findByTestId("chat-video-message");
    expect(screen.getByTestId("deleted-message-tombstone")).toBeTruthy();
    expect(wrap.querySelector("video").getAttribute("src")).toBe(VIDEO_URL);
    const download = screen.getByTestId("chat-video-download");
    expect(download.getAttribute("href")).toBe(VIDEO_URL);
    expect(screen.getByText("Reunião de ontem")).toBeTruthy();
  });

  it("áudio/PTT apagado mantém player", async () => {
    const { container } = renderList([
      baseMessage({
        id: "del-audio",
        mediaType: "audio",
        mediaUrl: AUDIO_URL,
        body: "áudio",
      }),
    ]);

    expect(await screen.findByTestId("deleted-message-tombstone")).toBeTruthy();
    const audio = container.querySelector("audio");
    expect(audio).toBeTruthy();
    expect(audio.getAttribute("src")).toBe(AUDIO_URL);
    expect(audio.hasAttribute("controls")).toBe(true);
  });

  it("documento apagado mantém download", async () => {
    renderList([
      baseMessage({
        id: "del-doc",
        mediaType: "application",
        mediaUrl: DOC_URL,
        body: "contrato.pdf",
      }),
    ]);

    expect(await screen.findByText("contrato.pdf")).toBeTruthy();
    expect(screen.getByTestId("deleted-message-tombstone")).toBeTruthy();
    const download = screen.getByText("Baixar").closest("a");
    expect(download.getAttribute("href")).toBe(DOC_URL);
  });

  it("sticker apagado continua visível", async () => {
    renderList([
      baseMessage({
        id: "del-sticker",
        mediaType: "sticker",
        mediaUrl: "https://example.com/public/fig.webp",
        body: "sticker",
      }),
    ]);

    expect(await screen.findByTestId("deleted-message-tombstone")).toBeTruthy();
    expect(screen.getByTestId("chat-lightbox-image").getAttribute("src")).toBe(
      "https://example.com/public/fig.webp"
    );
  });

  it("localização apagada mantém card e Visualizar", async () => {
    renderList([
      baseMessage({
        id: "del-loc",
        mediaType: "locationMessage",
        body: `${EVOLUTION_MAPS}|${COORDS}`,
      }),
    ]);

    const button = await screen.findByTestId("chat-location-open");
    expect(screen.getByTestId("deleted-message-tombstone")).toBeTruthy();
    expect(screen.getByTestId("chat-location-preview")).toBeTruthy();
    fireEvent.click(button);
    expect(openSpy).toHaveBeenCalledWith(
      EVOLUTION_MAPS,
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("contato/vCard apagado mantém SharedContactPreview", async () => {
    renderList([
      baseMessage({
        id: "del-contact",
        mediaType: "contactMessage",
        body: VCARD,
      }),
    ]);

    expect(await screen.findByTestId("chat-shared-contact")).toBeTruthy();
    expect(screen.getByTestId("deleted-message-tombstone")).toBeTruthy();
    expect(screen.getByText("Maria Silva")).toBeTruthy();
    expect(screen.queryByText(/BEGIN:VCARD/i)).toBeNull();
  });

  it("reload/hidratação: API com isDeleted=true ainda mostra indicador + conteúdo", async () => {
    renderList([
      baseMessage({
        id: "hydrated",
        mediaType: "conversation",
        body: "Contrato fechado nos 33mil",
        isDeleted: true,
      }),
    ]);

    expect(await screen.findByText("Contrato fechado nos 33mil")).toBeTruthy();
    expect(screen.getByTestId("deleted-message-tombstone").textContent).toContain(
      "Mensagem apagada pelo contato"
    );
  });

  it("mensagem apagada com reaction continua no alvo", async () => {
    renderList([
      baseMessage({
        id: "TARGET1",
        mediaType: "conversation",
        body: "Teste de mensagem",
        metaPayload: {
          whatsappReactions: [
            {
              emoji: "😂",
              fromMe: false,
              reactorKey: "peer",
            },
          ],
        },
      }),
    ]);

    expect(await screen.findByText("Teste de mensagem")).toBeTruthy();
    expect(screen.getByTestId("deleted-message-tombstone")).toBeTruthy();
    expect(screen.getByTestId("chat-message-reactions").textContent).toContain(
      "😂"
    );
  });

  it("mensagem apagada que é reply preserva quoted", async () => {
    renderList([
      baseMessage({
        id: "del-reply",
        mediaType: "conversation",
        body: "resposta depois apagada",
        quotedMsg: {
          id: "ORIG",
          mediaType: "conversation",
          body: "original citada",
          isDeleted: false,
        },
      }),
    ]);

    expect(await screen.findByText("resposta depois apagada")).toBeTruthy();
    expect(screen.getByText("original citada")).toBeTruthy();
    expect(screen.getByTestId("deleted-message-tombstone")).toBeTruthy();
  });

  it("Instagram reaction sem isDeleted não ganha tombstone", async () => {
    renderList([
      {
        id: "IG1",
        ticketId: 1,
        fromMe: false,
        mediaType: "reaction",
        body: "❤️ Reagiu à mensagem",
        isDeleted: false,
        createdAt,
        ack: 0,
        channel: "instagram",
      },
    ]);

    expect(await screen.findByText("❤️ Reagiu à mensagem")).toBeTruthy();
    expect(screen.queryByTestId("deleted-message-tombstone")).toBeNull();
  });
});
