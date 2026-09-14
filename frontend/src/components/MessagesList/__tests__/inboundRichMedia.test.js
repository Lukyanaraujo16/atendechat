/**
 * @jest-environment jsdom
 *
 * Localização, vídeo (download) e contato compartilhado na lista.
 */
import React from "react";
import { fireEvent, render, waitFor, screen } from "@testing-library/react";
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
const EVOLUTION_MAPS =
  "https://maps.google.com/maps?q=-20.370664596557617%2C-40.34754943847656&z=17&hl=pt-BR";
const COORDS = "-20.370664596557617, -40.34754943847656";
const THUMB =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const VCARD = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:Maria Silva",
  "TEL:+5527999999999",
  "END:VCARD",
].join("\n");

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

describe("MessagesList — localização, vídeo e contato", () => {
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

  it("Evolution mapsUrl|coords abre https e não /tickets/{coords}", async () => {
    renderList([
      {
        id: "loc-evo",
        ticketId: 1,
        fromMe: false,
        mediaType: "locationMessage",
        body: `${EVOLUTION_MAPS}|${COORDS}`,
        isDeleted: false,
        createdAt,
        ack: 0,
      },
    ]);

    const button = await screen.findByTestId("chat-location-open");
    fireEvent.click(button);
    expect(openSpy).toHaveBeenCalledWith(
      EVOLUTION_MAPS,
      "_blank",
      "noopener,noreferrer"
    );
    expect(openSpy.mock.calls[0][0]).toMatch(/^https:\/\//);
    expect(openSpy.mock.calls[0][0]).not.toMatch(/\/tickets\//);
  });

  it("Baileys dataURI|mapsUrl|coords também abre URL absoluta", async () => {
    renderList([
      {
        id: "loc-bai",
        ticketId: 1,
        fromMe: false,
        mediaType: "locationMessage",
        body: `${THUMB} | ${EVOLUTION_MAPS}|${COORDS}`,
        isDeleted: false,
        createdAt,
        ack: 0,
      },
    ]);

    const button = await screen.findByTestId("chat-location-open");
    fireEvent.click(button);
    expect(openSpy).toHaveBeenCalledWith(
      EVOLUTION_MAPS,
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("entrada inválida de localização não navega", async () => {
    renderList([
      {
        id: "loc-bad",
        ticketId: 1,
        fromMe: false,
        mediaType: "locationMessage",
        body: "/tickets/-20.370664596557617, -40.34754943847656",
        isDeleted: false,
        createdAt,
        ack: 0,
      },
    ]);

    const button = await screen.findByTestId("chat-location-open");
    expect(button.disabled || button.getAttribute("disabled") !== null).toBe(
      true
    );
    fireEvent.click(button);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("vídeo inbound reproduz e tem download com href persistido", async () => {
    const videoUrl = "https://example.com/public/company/clip.mp4";
    renderList([
      {
        id: "vid-1",
        ticketId: 1,
        fromMe: false,
        mediaType: "video",
        mediaUrl: videoUrl,
        body: "",
        isDeleted: false,
        createdAt,
        ack: 0,
      },
    ]);

    const wrap = await screen.findByTestId("chat-video-message");
    const video = wrap.querySelector("video");
    expect(video).toBeTruthy();
    expect(video.getAttribute("src")).toBe(videoUrl);
    expect(video.hasAttribute("controls")).toBe(true);

    const download = screen.getByTestId("chat-video-download");
    expect(download.getAttribute("href")).toBe(videoUrl);
    expect(download.getAttribute("target")).toBe("_blank");
  });

  it("vídeo sem URL válida não mostra ação de download quebrada", async () => {
    renderList([
      {
        id: "vid-empty",
        ticketId: 1,
        fromMe: false,
        mediaType: "video",
        mediaUrl: "",
        body: "",
        isDeleted: false,
        createdAt,
        ack: 0,
      },
      {
        id: "doc-1",
        ticketId: 1,
        fromMe: false,
        mediaType: "application",
        mediaUrl: "https://example.com/public/contrato.pdf",
        body: "contrato.pdf",
        isDeleted: false,
        createdAt,
        ack: 0,
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText("contrato.pdf")).toBeTruthy();
    });
    expect(screen.queryByTestId("chat-video-download")).toBeNull();
    expect(screen.getByText("Baixar")).toBeTruthy();
  });

  it("contactMessage e vcard legado renderizam card sem texto cru", async () => {
    renderList([
      {
        id: "ct-evo",
        ticketId: 1,
        fromMe: false,
        mediaType: "contactMessage",
        body: VCARD,
        isDeleted: false,
        createdAt,
        ack: 0,
      },
      {
        id: "ct-leg",
        ticketId: 1,
        fromMe: false,
        mediaType: "vcard",
        body: VCARD,
        isDeleted: false,
        createdAt,
        ack: 0,
      },
      {
        id: "txt-1",
        ticketId: 1,
        fromMe: true,
        mediaType: "conversation",
        body: "mensagem viva",
        isDeleted: false,
        createdAt,
        ack: 2,
      },
    ]);

    const cards = await screen.findAllByTestId("chat-shared-contact");
    expect(cards).toHaveLength(2);
    expect(screen.getAllByText("Maria Silva").length).toBe(2);
    expect(screen.getAllByText("+5527999999999").length).toBe(2);
    expect(screen.queryByText(/BEGIN:VCARD/i)).toBeNull();
    expect(screen.getByText("mensagem viva")).toBeTruthy();
  });
});
