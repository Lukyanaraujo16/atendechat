jest.mock("../../../models/Chat", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../../models/ChatUser", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

import Chat from "../../../models/Chat";
import ChatUser from "../../../models/ChatUser";
import User from "../../../models/User";
import { resolveInternalChatPushRecipients } from "../ResolveInternalChatPushRecipientsService";

const chatFind = Chat.findOne as jest.Mock;
const chatUserFind = ChatUser.findAll as jest.Mock;
const userFind = User.findAll as jest.Mock;

describe("resolveInternalChatPushRecipients", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chatFind.mockResolvedValue({ id: 10, uuid: "cuuid", companyId: 1 });
    chatUserFind.mockResolvedValue([
      { userId: 25 },
      { userId: 26 },
      { userId: 27 }
    ]);
    userFind.mockResolvedValue([{ id: 26 }, { id: 27 }]);
  });

  it("exclui remetente e devolve membros elegíveis", async () => {
    const result = await resolveInternalChatPushRecipients({
      companyId: 1,
      chatId: 10,
      senderUserId: 25
    });
    expect(result.chatExists).toBe(true);
    expect(result.recipientUserIds).toEqual([26, 27]);
    expect(result.recipientUserIds).not.toContain(25);
    expect(userFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 1,
          active: true
        })
      })
    );
  });

  it("chat de outra empresa não existe no filtro", async () => {
    chatFind.mockResolvedValue(null);
    const result = await resolveInternalChatPushRecipients({
      companyId: 1,
      chatId: 10,
      senderUserId: 25
    });
    expect(result.chatExists).toBe(false);
    expect(result.recipientUserIds).toEqual([]);
    expect(chatUserFind).not.toHaveBeenCalled();
  });

  it("usuário fora do chat / inativo / outro tenant filtrados pelo User.findAll", async () => {
    chatUserFind.mockResolvedValue([{ userId: 26 }, { userId: 99 }]);
    userFind.mockResolvedValue([{ id: 26 }]);
    const result = await resolveInternalChatPushRecipients({
      companyId: 1,
      chatId: 10,
      senderUserId: 25
    });
    expect(result.recipientUserIds).toEqual([26]);
    expect(result.recipientUserIds).not.toContain(99);
  });

  it("super user excluído (mock retorna só não-super)", async () => {
    chatUserFind.mockResolvedValue([{ userId: 26 }, { userId: 1 }]);
    userFind.mockResolvedValue([{ id: 26 }]);
    const result = await resolveInternalChatPushRecipients({
      companyId: 1,
      chatId: 10,
      senderUserId: 25
    });
    expect(result.recipientUserIds).toEqual([26]);
  });
});
