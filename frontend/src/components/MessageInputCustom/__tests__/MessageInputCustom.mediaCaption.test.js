/**
 * @jest-environment jsdom
 *
 * UX de caption para image/video no composer humano.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import fs from "fs";
import path from "path";

import MessageInputCustom from "../index";
import { AuthContext } from "../../../context/Auth/AuthContext";
import { ReplyMessageContext } from "../../../context/ReplyingMessage/ReplyingMessageContext";
import { SocketContext } from "../../../context/Socket/SocketContext";
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
    post: jest.fn(() => Promise.resolve({ data: {} })),
    request: jest.fn(() => Promise.resolve({ data: [] })),
    get: jest.fn(() => Promise.resolve({ data: [] })),
  },
}));

jest.mock("../../../errors/toastError", () => jest.fn());

jest.mock("../../../hooks/usePlanFlags", () => {
  const flags = { ready: true, loaded: true, effectiveFeatures: {} };
  return {
    __esModule: true,
    default: () => flags,
  };
});

jest.mock("../../../hooks/useQuickMessages", () => {
  const list = jest.fn(async () => []);
  return {
    __esModule: true,
    default: () => ({ list }),
  };
});

jest.mock("../../../hooks/useStickers", () => {
  const sendStickerToTicket = jest.fn();
  return {
    __esModule: true,
    default: () => ({ sendStickerToTicket }),
  };
});

jest.mock("../../../hooks/useWhatsAppPanelRecorder", () => {
  const recorder = {
    recording: false,
    handleStartRecording: jest.fn(),
    handleUploadAudio: jest.fn(),
    handleCancelAudio: jest.fn(),
  };
  return {
    useWhatsAppPanelRecorder: () => recorder,
  };
});

jest.mock("../useHumanWhatsAppTypingPresence", () => {
  const presence = { notifyTyping: jest.fn(), pauseNow: jest.fn() };
  return {
    __esModule: true,
    default: () => presence,
  };
});

jest.mock("../ComposerEmojiStickerPanel", () => () => null);
jest.mock("emoji-mart", () => ({ Picker: () => null }));

const source = fs.readFileSync(path.join(__dirname, "../index.js"), "utf8");
const setReplyingMessage = jest.fn();
const socketManager = {
  getSocket: () => ({ on: jest.fn(), off: jest.fn() }),
};

function makeFile(name, type) {
  return new File(["x"], name, { type });
}

function renderComposer(override = {}) {
  const theme = createTheme(getThemeOptions("light"));
  return render(
    <ThemeProvider theme={theme}>
      <AuthContext.Provider
        value={{
          user: { id: 1, name: "Ana", profile: "user", companyId: 1 },
        }}
      >
        <ReplyMessageContext.Provider
          value={{ replyingMessage: null, setReplyingMessage }}
        >
          <SocketContext.Provider value={socketManager}>
            <MessageInputCustom
              ticketId={9}
              ticketStatus="open"
              contact={{ name: "Cliente" }}
              ticket={{
                id: 9,
                status: "open",
                channel: "whatsapp",
                isGroup: false,
                isOrphan: false,
                whatsappId: 1,
                whatsapp: { id: 1, status: "CONNECTED" },
              }}
              {...override}
            />
          </SocketContext.Provider>
        </ReplyMessageContext.Provider>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

function attachViaAccept(container, files, accept) {
  const input = Array.from(container.querySelectorAll("input[type='file']")).find(
    (el) => el.getAttribute("accept") === accept
  );
  fireEvent.change(input, { target: { files } });
}

describe("MessageInputCustom media caption UX", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("companyId", "1");
    global.URL.createObjectURL = jest.fn(() => "blob:media-preview");
    global.URL.revokeObjectURL = jest.fn();
  });

  it("selecionar image mostra preview e campo de legenda", () => {
    const { container } = renderComposer();
    attachViaAccept(container, [makeFile("foto.png", "image/png")], "image/*,video/*");
    expect(screen.getByTestId("media-caption-composer")).toBeTruthy();
    expect(screen.getByTestId("media-preview-image")).toBeTruthy();
    expect(screen.getByTestId("media-caption-input")).toBeTruthy();
    expect(screen.getByPlaceholderText("Adicionar uma legenda...")).toBeTruthy();
  });

  it("selecionar video mostra preview e campo de legenda", () => {
    const { container } = renderComposer();
    attachViaAccept(container, [makeFile("clip.mp4", "video/mp4")], "image/*,video/*");
    expect(screen.getByTestId("media-preview-video")).toBeTruthy();
    expect(screen.getByTestId("media-caption-input")).toBeTruthy();
  });

  it("texto existente antes do anexo aparece no campo de legenda", () => {
    const { container } = renderComposer();
    const composer = screen.getByPlaceholderText("Digite uma mensagem");
    fireEvent.change(composer, { target: { value: "Segue a foto do produto" } });
    attachViaAccept(container, [makeFile("foto.png", "image/png")], "image/*,video/*");
    expect(screen.getByTestId("media-caption-input").value).toBe(
      "Segue a foto do produto"
    );
  });

  it("editar caption atualiza o campo", () => {
    const { container } = renderComposer();
    attachViaAccept(container, [makeFile("foto.png", "image/png")], "image/*,video/*");
    const caption = screen.getByTestId("media-caption-input");
    fireEvent.change(caption, { target: { value: "Legenda editada" } });
    expect(caption.value).toBe("Legenda editada");
  });

  it("apagar caption envia body vazio na imagem", async () => {
    const { container } = renderComposer();
    const composer = screen.getByPlaceholderText("Digite uma mensagem");
    fireEvent.change(composer, { target: { value: "vai sumir" } });
    attachViaAccept(container, [makeFile("foto.png", "image/png")], "image/*,video/*");
    fireEvent.change(screen.getByTestId("media-caption-input"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByLabelText("send-upload"));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const formData = api.post.mock.calls[0][1];
    expect(formData.getAll("body")).toEqual([""]);
  });

  it("cancelar mídia devolve o composer com o draft", () => {
    const { container } = renderComposer();
    const composer = screen.getByPlaceholderText("Digite uma mensagem");
    fireEvent.change(composer, { target: { value: "Segue a foto do produto" } });
    attachViaAccept(container, [makeFile("foto.png", "image/png")], "image/*,video/*");
    fireEvent.click(screen.getByLabelText("cancel-upload"));
    expect(screen.getByPlaceholderText("Digite uma mensagem").value).toBe(
      "Segue a foto do produto"
    );
    expect(screen.queryByTestId("media-caption-composer")).toBeNull();
  });

  it("paste de imagem abre o modo caption e não envia sozinho", () => {
    renderComposer();
    const composer = screen.getByPlaceholderText("Digite uma mensagem");
    const file = makeFile("pasted.png", "image/png");
    const preventDefault = jest.fn();
    fireEvent.paste(composer, {
      preventDefault,
      clipboardData: { files: [file] },
    });
    expect(screen.getByTestId("media-caption-composer")).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("document only não mostra campo de legenda", () => {
    const { container } = renderComposer();
    const docInput = Array.from(
      container.querySelectorAll("input[type='file']")
    ).find((el) => String(el.getAttribute("accept") || "").startsWith(".pdf"));
    fireEvent.change(docInput, {
      target: { files: [makeFile("contrato.pdf", "application/pdf")] },
    });
    expect(screen.getByTestId("media-document-bar")).toBeTruthy();
    expect(screen.queryByTestId("media-caption-input")).toBeNull();
    expect(screen.getByText("contrato.pdf")).toBeTruthy();
  });

  it("lote misto com image mostra caption field", () => {
    const { container } = renderComposer();
    attachViaAccept(
      container,
      [
        makeFile("contrato.pdf", "application/pdf"),
        makeFile("foto.png", "image/png"),
      ],
      "image/*,video/*"
    );
    expect(screen.getByTestId("media-caption-composer")).toBeTruthy();
    expect(screen.getByTestId("media-caption-input")).toBeTruthy();
  });

  it("câmera mobile entra na mesma UX de caption", () => {
    const { container } = renderComposer();
    const camera = container.querySelector('input[capture="environment"]');
    fireEvent.change(camera, {
      target: { files: [makeFile("captura.jpg", "image/jpeg")] },
    });
    expect(screen.getByTestId("media-caption-composer")).toBeTruthy();
    expect(screen.getByTestId("media-preview-image")).toBeTruthy();
  });

  it("envio com caption usa o texto visível", async () => {
    const { container } = renderComposer();
    attachViaAccept(container, [makeFile("foto.png", "image/png")], "image/*,video/*");
    fireEvent.change(screen.getByTestId("media-caption-input"), {
      target: { value: "Material da obra" },
    });
    fireEvent.click(screen.getByLabelText("send-upload"));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const formData = api.post.mock.calls[0][1];
    expect(formData.getAll("body")).toEqual(["Material da obra"]);
  });
});

describe("MessageInputCustom media caption regressões de fluxo", () => {
  it("quick reply com mídia permanece fora do state medias", () => {
    const quick = source.slice(
      source.indexOf("const handleUploadQuickMessageMedia"),
      source.indexOf("const handleQuickAnswersClick")
    );
    const click = source.slice(
      source.indexOf("const handleQuickAnswersClick"),
      source.indexOf("quickApplyFromModalRef")
    );
    expect(quick).toContain("formData.append(\"body\"");
    expect(quick).not.toMatch(/setMedias/);
    expect(click).not.toMatch(/setMedias/);
    expect(click).toContain("handleUploadQuickMessageMedia");
  });

  it("áudio/PTT/sticker continuam em ramos próprios", () => {
    expect(source).toContain("useWhatsAppPanelRecorder");
    expect(source).toContain("handleStartRecording");
    expect(source).toContain("handleUploadAudio");
    expect(source).toContain("handleStickerSend");
    expect(source).toContain("sendStickerToTicket");
  });

  it("não introduz UX provider-specific", () => {
    expect(source).not.toMatch(/connectionProvider/);
    expect(source).not.toMatch(/\bevolution\b/i);
    expect(source).not.toMatch(/\bbaileys\b/i);
  });
});
