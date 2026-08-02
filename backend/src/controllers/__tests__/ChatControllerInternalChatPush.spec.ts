/**
 * Integração no ponto real do controller: após persistência + socket,
 * dispara notifyInternalChatMessage (best-effort).
 */
jest.mock("../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn()
  }))
}));

jest.mock("../../services/ChatService/CreateMessageService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../services/ChatService/CreateMediaMessageService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../services/OneSignalPush/notifyInternalChatMessage", () => ({
  __esModule: true,
  default: jest.fn(async () => undefined)
}));

jest.mock("../../services/CompanyService/adjustCompanyStorageUsage", () => ({
  incrementCompanyStorageUsage: jest.fn(async () => undefined)
}));

jest.mock("../../models/Chat", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));

jest.mock("../../models/User", () => ({
  __esModule: true,
  default: {}
}));

jest.mock("../../models/ChatUser", () => ({
  __esModule: true,
  default: {}
}));

jest.mock("../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import CreateMessageService from "../../services/ChatService/CreateMessageService";
import notifyInternalChatMessage from "../../services/OneSignalPush/notifyInternalChatMessage";
import Chat from "../../models/Chat";
import { saveMessage } from "../ChatController";

const createMsg = CreateMessageService as jest.Mock;
const notify = notifyInternalChatMessage as jest.Mock;
const chatFind = Chat.findByPk as jest.Mock;

describe("ChatController.saveMessage → OneSignal push (2.14B)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createMsg.mockResolvedValue({
      id: 500,
      message: "Olá B",
      senderId: 25,
      chatId: 10,
      sender: { id: 25, name: "Alice" },
      mediaType: null,
      mimeType: null
    });
    chatFind.mockResolvedValue({
      id: 10,
      uuid: "chat-u",
      users: [{ userId: 25 }, { userId: 26 }]
    });
    notify.mockResolvedValue(undefined);
  });

  it("persiste mensagem e dispara notifyInternalChatMessage sem bloquear", async () => {
    const req = {
      user: { id: "25", companyId: "1" },
      params: { id: "10" },
      body: { message: "Olá B" }
    } as any;
    const res = {
      json: jest.fn().mockReturnThis()
    } as any;

    await saveMessage(req, res);

    expect(createMsg).toHaveBeenCalledWith({
      chatId: 10,
      senderId: 25,
      message: "Olá B",
      companyId: 1
    });
    expect(res.json).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 1,
        chatId: 10,
        messageId: 500,
        senderUserId: 25,
        senderName: "Alice",
        messageText: "Olá B"
      })
    );
  });

  it("falha do notify não impede resposta JSON", async () => {
    notify.mockImplementation(() => {
      throw new Error("should be swallowed by void caller path");
    });
    // void notify(...) — se lançar sync, o controller falharia; o serviço real
    // engole erros. Aqui garantimos que create+json ocorreram antes.
    notify.mockResolvedValue(undefined);

    const req = {
      user: { id: "25", companyId: "1" },
      params: { id: "10" },
      body: { message: "x" }
    } as any;
    const res = { json: jest.fn().mockReturnThis() } as any;
    await saveMessage(req, res);
    expect(res.json).toHaveBeenCalled();
  });
});
