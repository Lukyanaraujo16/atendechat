import { navigateFromNotificationData } from "../notificationNavigation";

describe("navigateFromNotificationData — chat interno (2.14B)", () => {
  it("navega para /chats/:uuid", () => {
    const history = { push: jest.fn() };
    navigateFromNotificationData(
      {
        type: "internal_chat_message",
        chatUuid: "chat-1",
        chatId: 10,
      },
      history,
      { effectiveFeatures: {} }
    );
    expect(history.push).toHaveBeenCalledWith("/chats/chat-1");
  });

  it("sem uuid usa chatId; sem ambos vai a /chats", () => {
    const history = { push: jest.fn() };
    navigateFromNotificationData(
      { type: "internal_chat_message", chatId: 7 },
      history
    );
    expect(history.push).toHaveBeenCalledWith("/chats/7");

    history.push.mockClear();
    navigateFromNotificationData({ type: "internal_chat_message" }, history);
    expect(history.push).toHaveBeenCalledWith("/chats");
  });

  it("não exige inbox WhatsApp para chat interno", () => {
    const history = { push: jest.fn() };
    navigateFromNotificationData(
      { type: "internal_chat_message", chatUuid: "z" },
      history,
      { effectiveFeatures: { "attendance.whatsapp": false } }
    );
    expect(history.push).toHaveBeenCalledWith("/chats/z");
  });
});
