/**
 * @jest-environment jsdom
 *
 * Render da lista: imagem sem caption, documento com filename, tombstone.
 */
import React from "react";
import { render, waitFor, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import fs from "fs";
import path from "path";

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

const MESSAGES = [
  {
    id: "png-no-caption",
    ticketId: 1,
    fromMe: true,
    mediaType: "image",
    mediaUrl: "https://example.com/public/foto.png",
    body: "foto.png",
    isDeleted: false,
    createdAt,
    ack: 2,
  },
  {
    id: "jpeg-no-caption",
    ticketId: 1,
    fromMe: false,
    mediaType: "image",
    mediaUrl: "https://example.com/public/foto.jpeg",
    body: "foto.jpeg",
    isDeleted: false,
    createdAt,
    ack: 0,
  },
  {
    id: "png-caption",
    ticketId: 1,
    fromMe: true,
    mediaType: "image",
    mediaUrl: "https://example.com/public/imagem.png",
    body: "Comprovante do pagamento",
    isDeleted: false,
    createdAt,
    ack: 2,
  },
  {
    id: "jpeg-caption",
    ticketId: 1,
    fromMe: false,
    mediaType: "image",
    mediaUrl: "https://example.com/public/foto.jpg",
    body: "Comprovante JPEG",
    isDeleted: false,
    createdAt,
    ack: 0,
  },
  {
    id: "doc-pdf",
    ticketId: 1,
    fromMe: false,
    mediaType: "application",
    mediaUrl: "https://example.com/public/contrato.pdf",
    body: "contrato.pdf",
    isDeleted: false,
    createdAt,
    ack: 0,
  },
  {
    id: "deleted-in",
    ticketId: 1,
    fromMe: false,
    mediaType: "image",
    mediaUrl: "https://example.com/public/apagada.png",
    body: "imagem.png",
    isDeleted: true,
    createdAt,
    ack: 0,
  },
  {
    id: "deleted-out",
    ticketId: 1,
    fromMe: true,
    mediaType: "image",
    mediaUrl: "https://example.com/public/apagada.jpeg",
    body: "foto.jpeg",
    isDeleted: true,
    createdAt,
    ack: 2,
  },
  {
    id: "deleted-text",
    ticketId: 1,
    fromMe: false,
    mediaType: "conversation",
    body: "texto apagado",
    isDeleted: true,
    createdAt,
    ack: 0,
  },
  {
    id: "live-text",
    ticketId: 1,
    fromMe: true,
    mediaType: "conversation",
    body: "mensagem viva",
    isDeleted: false,
    createdAt,
    ack: 2,
  },
];

function renderList(mode, messages = MESSAGES) {
  const theme = createTheme({ ...getThemeOptions(mode), mode });
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

async function waitForChat() {
  await waitFor(
    () => {
      expect(screen.getAllByTestId("chat-lightbox-image").length).toBeGreaterThan(
        0
      );
    },
    { timeout: 3000 }
  );
}

describe("MessagesList — mídia apagada e imagem sem caption", () => {
  beforeEach(() => {
    localStorage.setItem("companyId", "1");
    localStorage.setItem("i18nextLng", "pt");
    api.get.mockReset();
  });

  it("renderiza PNG/JPEG, esconde filename técnico, mantém documento e tombstone", async () => {
    const { container, queryByText, getByText, getAllByTestId } = renderList(
      "light"
    );
    await waitForChat();

    const lightboxes = getAllByTestId("chat-lightbox-image");
    expect(lightboxes).toHaveLength(6);
    expect(
      lightboxes.map((node) => node.getAttribute("src"))
    ).toEqual(
      expect.arrayContaining([
        "https://example.com/public/foto.png",
        "https://example.com/public/foto.jpeg",
        "https://example.com/public/imagem.png",
        "https://example.com/public/foto.jpg",
        "https://example.com/public/apagada.png",
        "https://example.com/public/apagada.jpeg",
      ])
    );

    expect(queryByText("foto.png")).toBeNull();
    expect(queryByText("foto.jpeg")).toBeNull();
    expect(queryByText("imagem.png")).toBeNull();
    expect(getByText("Comprovante do pagamento")).toBeTruthy();
    expect(getByText("Comprovante JPEG")).toBeTruthy();
    expect(getByText("contrato.pdf")).toBeTruthy();

    const tombstones = getAllByTestId("deleted-message-tombstone");
    expect(tombstones).toHaveLength(3);
    expect(tombstones.map((node) => node.textContent).join(" ")).toContain(
      "Mensagem apagada pelo contato"
    );

    expect(getByText("texto apagado")).toBeTruthy();
    expect(getByText("mensagem viva")).toBeTruthy();

    const actionTriggers = container.querySelectorAll("#messageActionsButton");
    expect(actionTriggers.length).toBe(6);
  });

  it("dark e light montam a lista sem regressão estrutural", async () => {
    const light = renderList("light");
    await waitForChat();
    expect(light.container.querySelector("#messagesList")).toBeTruthy();
    expect(light.getAllByTestId("deleted-message-tombstone").length).toBe(3);
    light.unmount();

    const dark = renderList("dark");
    await waitForChat();
    expect(dark.container.querySelector("#messagesList")).toBeTruthy();
    expect(dark.getAllByTestId("deleted-message-tombstone").length).toBe(3);
    expect(dark.getAllByTestId("chat-lightbox-image").length).toBe(6);
  });

  it("MessagesList não deixa o trigger disabled visível em mensagem apagada", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../index.js"),
      "utf8"
    );
    expect(src).toContain("shouldShowMessageActionMenu(message)");
    expect(src).toContain("DeletedMessageTombstone");
    expect(src).toContain("shouldRenderChatMedia");
    expect(src).not.toMatch(
      /disabled=\{message\.isDeleted\}/
    );
  });

  it("quotedMsg.isDeleted mantém preview original com indicador", async () => {
    const quotedDeleted = {
      id: "quoted-deleted-img",
      ticketId: 1,
      fromMe: false,
      mediaType: "image",
      mediaUrl: "https://example.com/public/citada-apagada.png",
      body: "conteudo antigo da imagem",
      isDeleted: true,
      createdAt,
      ack: 0,
    };
    const { queryByText, getByText, getByTestId } = renderList("light", [
      {
        id: "reply-to-deleted",
        ticketId: 1,
        fromMe: true,
        mediaType: "conversation",
        body: "respondendo a apagada",
        isDeleted: false,
        quotedMsg: quotedDeleted,
        createdAt,
        ack: 2,
      },
    ]);

    await waitFor(
      () => {
        expect(getByText("respondendo a apagada")).toBeTruthy();
      },
      { timeout: 3000 }
    );

    expect(getByTestId("deleted-message-tombstone").textContent).toContain(
      "Mensagem apagada pelo contato"
    );
    expect(queryByText("citada-apagada.png")).toBeNull();
    expect(getByTestId("chat-lightbox-image").getAttribute("src")).toBe(
      "https://example.com/public/citada-apagada.png"
    );
  });
});
