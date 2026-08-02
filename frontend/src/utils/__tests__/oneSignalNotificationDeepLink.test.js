import { resolveOneSignalNotificationPath } from "../oneSignalNotificationDeepLink";

describe("resolveOneSignalNotificationPath (2.14B)", () => {
  it("chat interno por targetUrl", () => {
    expect(
      resolveOneSignalNotificationPath({
        type: "internal_chat_message",
        targetUrl: "/chats/abc-uuid",
      })
    ).toBe("/chats/abc-uuid");
  });

  it("chat interno por chatUuid", () => {
    expect(
      resolveOneSignalNotificationPath({
        type: "internal_chat_message",
        chatUuid: "cuuid",
        chatId: 9,
      })
    ).toBe("/chats/cuuid");
  });

  it("chat interno por chatId", () => {
    expect(
      resolveOneSignalNotificationPath({
        type: "internal_chat_message",
        chatId: 9,
      })
    ).toBe("/chats/9");
  });

  it("ticket por uuid (regressão)", () => {
    expect(
      resolveOneSignalNotificationPath({
        type: "ticket_message",
        ticketUuid: "t-uuid",
        ticketId: 1,
      })
    ).toBe("/tickets/t-uuid");
  });

  it("payload desconhecido → null (fallback seguro)", () => {
    expect(resolveOneSignalNotificationPath({})).toBeNull();
    expect(resolveOneSignalNotificationPath(null)).toBeNull();
    expect(
      resolveOneSignalNotificationPath({ targetUrl: "https://evil.example" })
    ).toBeNull();
    expect(
      resolveOneSignalNotificationPath({ targetUrl: "//evil.example" })
    ).toBeNull();
  });

  it("não embute conteúdo sensível — só path", () => {
    const path = resolveOneSignalNotificationPath({
      type: "internal_chat_message",
      chatUuid: "x",
      body: "segredo",
      token: "abc",
    });
    expect(path).toBe("/chats/x");
    expect(path).not.toContain("segredo");
    expect(path).not.toContain("token");
  });
});
