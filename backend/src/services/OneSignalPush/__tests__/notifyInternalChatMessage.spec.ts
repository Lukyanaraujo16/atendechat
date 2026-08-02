jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock("../pushDedupe", () => ({
  acquireTicketPushDedupe: jest.fn()
}));

jest.mock("../ResolveInternalChatPushRecipientsService", () => ({
  resolveInternalChatPushRecipients: jest.fn()
}));

jest.mock("../SendOneSignalPushNotificationService", () => ({
  __esModule: true,
  default: jest.fn(async () => undefined)
}));

import { logger } from "../../../utils/logger";
import { acquireTicketPushDedupe } from "../pushDedupe";
import { resolveInternalChatPushRecipients } from "../ResolveInternalChatPushRecipientsService";
import SendOneSignalPushNotificationService from "../SendOneSignalPushNotificationService";
import notifyInternalChatMessage from "../notifyInternalChatMessage";

const acquire = acquireTicketPushDedupe as jest.Mock;
const resolveRecipients = resolveInternalChatPushRecipients as jest.Mock;
const sendPush = SendOneSignalPushNotificationService as jest.Mock;

describe("notifyInternalChatMessage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    acquire.mockResolvedValue(true);
    resolveRecipients.mockResolvedValue({
      recipientUserIds: [26],
      chatUuid: "uuid-chat",
      chatExists: true
    });
    sendPush.mockResolvedValue(undefined);
  });

  it("A→B: envia só para B com External ID individual via dispatcher", async () => {
    await notifyInternalChatMessage({
      companyId: 1,
      chatId: 10,
      messageId: 100,
      senderUserId: 25,
      senderName: "A",
      messageText: "oi"
    });

    expect(acquire).toHaveBeenCalledWith("internal-chat:msg:100", 120);
    expect(resolveRecipients).toHaveBeenCalledWith({
      companyId: 1,
      chatId: 10,
      senderUserId: 25
    });
    expect(sendPush).toHaveBeenCalledTimes(1);
    const args = sendPush.mock.calls[0][0];
    expect(args.eventType).toBe("internal_chat_message");
    expect(args.preferenceCategory).toBeNull();
    expect(args.recipientUserIds).toEqual([26]);
    expect(args.excludeUserIds).toEqual([25]);
    expect(args.applyActiveTicketViewFilter).toBe(false);
    expect(args.data.type).toBe("internal_chat_message");
    expect(args.data.targetUrl).toBe("/chats/uuid-chat");
    expect(args.data.companyId).toBe(1);
    expect(args.title).toBe("Nova mensagem no chat interno");
    expect(args.body).toBe("A: oi");
  });

  it("grupo A/B/C: B e C recebem", async () => {
    resolveRecipients.mockResolvedValue({
      recipientUserIds: [26, 27],
      chatUuid: "g1",
      chatExists: true
    });
    await notifyInternalChatMessage({
      companyId: 1,
      chatId: 11,
      messageId: 101,
      senderUserId: 25,
      senderName: "A",
      messageText: "grupo"
    });
    expect(sendPush.mock.calls[0][0].recipientUserIds).toEqual([26, 27]);
    expect(sendPush.mock.calls[0][0].recipientUserIds).not.toContain(25);
  });

  it("dedupe impede segundo envio", async () => {
    acquire.mockResolvedValue(false);
    await notifyInternalChatMessage({
      companyId: 1,
      chatId: 10,
      messageId: 100,
      senderUserId: 25,
      messageText: "dup"
    });
    expect(sendPush).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ skipped: "dedupe_message" }),
      "[OneSignalPush]"
    );
  });

  it("Redis indisponível (acquire true fail-open) ainda envia", async () => {
    acquire.mockResolvedValue(true);
    await notifyInternalChatMessage({
      companyId: 1,
      chatId: 10,
      messageId: 102,
      senderUserId: 25,
      messageText: "ok"
    });
    expect(sendPush).toHaveBeenCalled();
  });

  it("sem destinatários não chama OneSignal", async () => {
    resolveRecipients.mockResolvedValue({
      recipientUserIds: [],
      chatUuid: "u",
      chatExists: true
    });
    await notifyInternalChatMessage({
      companyId: 1,
      chatId: 10,
      messageId: 103,
      senderUserId: 25
    });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("falha do dispatcher não propaga", async () => {
    sendPush.mockRejectedValue(new Error("onesignal down"));
    await expect(
      notifyInternalChatMessage({
        companyId: 1,
        chatId: 10,
        messageId: 104,
        senderUserId: 25,
        messageText: "x"
      })
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("config/chat ausente não quebra", async () => {
    resolveRecipients.mockResolvedValue({
      recipientUserIds: [],
      chatUuid: null,
      chatExists: false
    });
    await notifyInternalChatMessage({
      companyId: 1,
      chatId: 999,
      messageId: 105,
      senderUserId: 25
    });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("mídia imagem usa label", async () => {
    await notifyInternalChatMessage({
      companyId: 1,
      chatId: 10,
      messageId: 106,
      senderUserId: 25,
      senderName: "A",
      messageText: "",
      mediaType: "image"
    });
    expect(sendPush.mock.calls[0][0].body).toBe("A: Enviou uma imagem");
  });
});
