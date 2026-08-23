/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import MessageOptionsMenu from "../index";
import { AuthContext } from "../../../context/Auth/AuthContext";
import { ReplyMessageContext } from "../../../context/ReplyingMessage/ReplyingMessageContext";

jest.mock("../../../hooks/useStickers", () => ({
  __esModule: true,
  default: () => ({ saveStickerFromMessage: jest.fn() }),
}));

const theme = createTheme();

function renderMenu(message, { menuOpen = true } = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <AuthContext.Provider value={{ user: { profile: "user" } }}>
        <ReplyMessageContext.Provider
          value={{ setReplyingMessage: jest.fn(), replyingMessage: null }}
        >
          <MessageOptionsMenu
            message={message}
            menuOpen={menuOpen}
            handleClose={jest.fn()}
            anchorEl={document.createElement("div")}
          />
        </ReplyMessageContext.Provider>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

describe("MessageOptionsMenu — mensagem apagada", () => {
  it("não renderiza menu quando message.isDeleted", () => {
    renderMenu({
      id: "del-1",
      isDeleted: true,
      fromMe: true,
      body: "foto.png",
      mediaType: "image",
    });
    expect(screen.queryByText("Deletar")).toBeNull();
    expect(screen.queryByText("Responder")).toBeNull();
  });

  it("mensagem viva outbound continua com Reply e Delete", () => {
    renderMenu({
      id: "live-1",
      isDeleted: false,
      fromMe: true,
      body: "olá",
      mediaType: "conversation",
    });
    expect(screen.getByText("Deletar")).toBeTruthy();
    expect(screen.getByText("Responder")).toBeTruthy();
  });

  it("mensagem viva inbound continua com Reply", () => {
    renderMenu({
      id: "live-2",
      isDeleted: false,
      fromMe: false,
      body: "olá",
      mediaType: "conversation",
    });
    expect(screen.queryByText("Deletar")).toBeNull();
    expect(screen.getByText("Responder")).toBeTruthy();
  });
});
