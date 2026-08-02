/**
 * Contrato External ID OneSignal = String(userId), nunca companyId (Fase 2.13E).
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
import SendOneSignalPushNotificationService from "../SendOneSignalPushNotificationService";
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

  it("envia include_external_user_ids com String(userId), não companyId", async () => {
    await SendOneSignalPushNotificationService({
      eventType: "ticket.message",
      preferenceCategory: "ticket_message" as any,
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
    expect(payload.include_external_user_ids).toEqual(["25"]);
    expect(payload.include_external_user_ids).not.toContain("1");
    expect(payload.app_id).toBe("app-test");
    expect(axiosPost.mock.calls[0][2].headers.Authorization).toMatch(/^Key /);
  });

  it("user 26 na mesma empresa 1 recebe External ID 26", async () => {
    await SendOneSignalPushNotificationService({
      eventType: "ticket.message",
      preferenceCategory: "ticket_message" as any,
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
    expect(axiosPost.mock.calls[0][1].include_external_user_ids).toEqual(["26"]);
  });

  it("múltiplos utilizadores da mesma empresa mantêm IDs individuais", async () => {
    await SendOneSignalPushNotificationService({
      eventType: "ticket.message",
      preferenceCategory: "ticket_message" as any,
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
    const ids = axiosPost.mock.calls[0][1].include_external_user_ids;
    expect(ids).toEqual(["25", "26"]);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain("1");
  });

  it("não envia companyId como destinatário único", async () => {
    await SendOneSignalPushNotificationService({
      eventType: "ticket.message",
      preferenceCategory: "ticket_message" as any,
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
    expect(axiosPost.mock.calls[0][1].include_external_user_ids).not.toEqual([
      "1"
    ]);
  });
});
