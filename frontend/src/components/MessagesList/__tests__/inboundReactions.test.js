/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
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

const createdAt = "2026-08-22T12:00:00.000Z";

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

describe("MessagesList — reações WhatsApp", () => {
  beforeEach(() => {
    localStorage.setItem("companyId", "1");
    localStorage.setItem("i18nextLng", "pt");
    api.get.mockReset();
  });

  it("emoji fica no alvo e reactionMessage não vira balão", async () => {
    renderList([
      {
        id: "TARGET1",
        ticketId: 1,
        fromMe: true,
        mediaType: "conversation",
        body: "Teste de mensagem",
        isDeleted: false,
        createdAt,
        ack: 2,
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
      },
      {
        id: "R1",
        ticketId: 1,
        fromMe: false,
        mediaType: "reactionMessage",
        body: "😂",
        quotedMsgId: "TARGET1",
        isDeleted: false,
        createdAt,
        ack: 0,
        channel: "whatsapp",
      },
      {
        id: "TXT1",
        ticketId: 1,
        fromMe: false,
        mediaType: "conversation",
        body: "mensagem comum",
        isDeleted: false,
        createdAt,
        ack: 0,
        channel: "whatsapp",
      },
    ]);

    expect(await screen.findByText("Teste de mensagem")).toBeTruthy();
    expect(screen.getByText("mensagem comum")).toBeTruthy();
    expect(screen.getByTestId("chat-message-reactions").textContent).toContain(
      "😂"
    );
    expect(screen.queryByText("BEGIN:VCARD")).toBeNull();
  });

  it("Instagram reaction continua no card próprio", async () => {
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
  });

  it("quoted/reply de texto comum continua visível", async () => {
    renderList([
      {
        id: "REPLY1",
        ticketId: 1,
        fromMe: true,
        mediaType: "conversation",
        body: "respondendo",
        isDeleted: false,
        createdAt,
        ack: 2,
        quotedMsg: {
          id: "ORIG",
          mediaType: "conversation",
          body: "original citada",
          isDeleted: false,
        },
      },
    ]);

    expect(await screen.findByText("respondendo")).toBeTruthy();
    expect(screen.getByText("original citada")).toBeTruthy();
  });
});
