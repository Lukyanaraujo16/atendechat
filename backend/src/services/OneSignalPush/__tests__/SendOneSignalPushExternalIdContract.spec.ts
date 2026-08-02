/**
 * Contrato External ID OneSignal = String(userId), nunca companyId.
 * Targeting atual: include_aliases.external_id + target_channel=push.
 */
jest.mock("axios", () => ({
  __esModule: true,
  default: { post: jest.fn() }
}));

jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock("../GetOneSignalServerSettingsService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../libs/cache", () => ({
  filterOutUsersViewingTicket: jest.fn(async (_c, _t, ids: number[]) => ({
    kept: ids,
    skippedActiveView: []
  }))
}));

jest.mock("../../UserNotificationService/persistInAppNotificationsFromPush", () => ({
  __esModule: true,
  default: jest.fn(async () => undefined)
}));

jest.mock("../userPushPreferences", () => ({
  PushPreferenceCategory: { TICKET_MESSAGE: "ticket_message" },
  loadEffectivePreferencesMap: jest.fn(async () => new Map()),
  filterUserIdsByPushPreference: jest.fn((ids: number[]) => ({
    kept: ids,
    skippedByPreferences: []
  }))
}));

import axios from "axios";
import SendOneSignalPushNotificationService, {
  buildOneSignalPushPayload
} from "../SendOneSignalPushNotificationService";
import GetOneSignalServerSettingsService from "../GetOneSignalServerSettingsService";

const axiosPost = axios.post as jest.Mock;
const getSettings = GetOneSignalServerSettingsService as jest.Mock;

describe("SendOneSignalPushNotificationService — external id contract (2.13E)", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    getSettings.mockReset();
    getSettings.mockResolvedValue({
      enabled: true,
      appId: "app-test",
      restApiKey: "rest-key-test"
    });
    axiosPost.mockResolvedValue({ data: { id: "notif-1", recipients: 1 } });
  });

  it("buildOneSignalPushPayload usa include_aliases.external_id", () => {
    const payload = buildOneSignalPushPayload({
      appId: "app",
      externalUserIds: ["25"],
      title: "t",
      body: "b",
      data: { type: "x" }
    });
    expect(payload.include_aliases).toEqual({ external_id: ["25"] });
    expect(payload.target_channel).toBe("push");
    expect(payload).not.toHaveProperty("include_external_user_ids");
  });

  it("envia include_aliases.external_id com String(userId), não companyId", async () => {
    await SendOneSignalPushNotificationService({
      eventType: "ticket.message",
      preferenceCategory: "message",
      companyId: 1,
      ticketId: 10,
      recipientUserIds: [25],
      title: "t",
      body: "b",
      data: {
        type: "ticket.message",
        ticketId: 10,
        companyId: 1,
        status: "open"
      }
    });

    expect(axiosPost).toHaveBeenCalledTimes(1);
    const payload = axiosPost.mock.calls[0][1];
    expect(payload.include_aliases.external_id).toEqual(["25"]);
    expect(payload.include_aliases.external_id).not.toContain("1");
    expect(payload.target_channel).toBe("push");
    expect(payload.app_id).toBe("app-test");
    expect(payload).not.toHaveProperty("include_external_user_ids");
    expect(axiosPost.mock.calls[0][2].headers.Authorization).toMatch(/^Key /);
  });

  it("user 26 na mesma empresa 1 recebe External ID 26", async () => {
    await SendOneSignalPushNotificationService({
      eventType: "ticket.message",
      preferenceCategory: "message",
      companyId: 1,
      ticketId: 11,
      recipientUserIds: [26],
      title: "t",
      body: "b",
      data: {
        type: "ticket.message",
        ticketId: 11,
        companyId: 1,
        status: "open"
      }
    });
    expect(axiosPost.mock.calls[0][1].include_aliases.external_id).toEqual([
      "26"
    ]);
  });

  it("múltiplos utilizadores da mesma empresa mantêm IDs individuais", async () => {
    await SendOneSignalPushNotificationService({
      eventType: "ticket.message",
      preferenceCategory: "message",
      companyId: 1,
      ticketId: 12,
      recipientUserIds: [25, 26],
      title: "t",
      body: "b",
      data: {
        type: "ticket.message",
        ticketId: 12,
        companyId: 1,
        status: "open"
      }
    });
    const ids = axiosPost.mock.calls[0][1].include_aliases.external_id;
    expect(ids).toEqual(["25", "26"]);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain("1");
  });

  it("não envia companyId como destinatário único", async () => {
    await SendOneSignalPushNotificationService({
      eventType: "ticket.message",
      preferenceCategory: "message",
      companyId: 1,
      ticketId: 13,
      recipientUserIds: [25],
      title: "t",
      body: "b",
      data: {
        type: "ticket.message",
        ticketId: 13,
        companyId: 1,
        status: "open"
      }
    });
    const body = JSON.stringify(axiosPost.mock.calls[0][1]);
    expect(body).toContain('"25"');
    expect(axiosPost.mock.calls[0][1].include_aliases.external_id).not.toEqual([
      "1"
    ]);
  });

  it("chat interno: External IDs individuais e preferenceCategory null", async () => {
    const { filterOutUsersViewingTicket } = jest.requireMock(
      "../../../libs/cache"
    );
    await SendOneSignalPushNotificationService({
      eventType: "internal_chat_message",
      preferenceCategory: null,
      companyId: 1,
      chatId: 10,
      ticketId: null,
      applyActiveTicketViewFilter: false,
      recipientUserIds: [25],
      title: "Nova mensagem no chat interno",
      body: "A: oi",
      data: {
        type: "internal_chat_message",
        companyId: 1,
        chatId: 10,
        chatUuid: "c-uuid",
        targetUrl: "/chats/c-uuid"
      }
    });
    expect(filterOutUsersViewingTicket).not.toHaveBeenCalled();
    expect(axiosPost.mock.calls[0][1].include_aliases.external_id).toEqual([
      "25"
    ]);
    expect(axiosPost.mock.calls[0][1].include_aliases.external_id).not.toEqual([
      "1"
    ]);
    expect(axiosPost.mock.calls[0][1].data.type).toBe("internal_chat_message");
  });

  it("usuários distintos mesma empresa: só o destinatário real", async () => {
    await SendOneSignalPushNotificationService({
      eventType: "internal_chat_message",
      preferenceCategory: null,
      companyId: 1,
      chatId: 11,
      applyActiveTicketViewFilter: false,
      recipientUserIds: [25],
      excludeUserIds: [26],
      title: "t",
      body: "b",
      data: {
        type: "internal_chat_message",
        companyId: 1,
        chatId: 11,
        targetUrl: "/chats/11"
      }
    });
    expect(axiosPost.mock.calls[0][1].include_aliases.external_id).toEqual([
      "25"
    ]);
    expect(
      axiosPost.mock.calls[0][1].include_aliases.external_id
    ).not.toContain("26");
  });
});
