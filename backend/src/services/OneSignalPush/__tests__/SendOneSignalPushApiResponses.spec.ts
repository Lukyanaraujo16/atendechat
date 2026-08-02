/**
 * Tratamento de respostas OneSignal: recipients 0, HTTP errors, timeout.
 */
import axios from "axios";
import { logger } from "../../../utils/logger";
import SendOneSignalPushNotificationService from "../SendOneSignalPushNotificationService";
import GetOneSignalServerSettingsService from "../GetOneSignalServerSettingsService";
import DispatchDirectedOneSignalTestPushService from "../DispatchDirectedOneSignalTestPushService";

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

jest.mock(
  "../../UserNotificationService/persistInAppNotificationsFromPush",
  () => ({
    __esModule: true,
    default: jest.fn(async () => undefined)
  })
);

jest.mock("../userPushPreferences", () => ({
  loadEffectivePreferencesMap: jest.fn(async () => new Map()),
  filterUserIdsByPushPreference: jest.fn((ids: number[]) => ({
    kept: ids,
    skippedByPreferences: []
  }))
}));

const axiosPost = axios.post as jest.Mock;
const getSettings = GetOneSignalServerSettingsService as jest.Mock;

async function sendBasic() {
  return SendOneSignalPushNotificationService({
    eventType: "ticket_message_inbound",
    preferenceCategory: "message",
    companyId: 1,
    ticketId: 10,
    messageId: "m1",
    recipientUserIds: [25],
    title: "t",
    body: "b",
    data: {
      type: "ticket_message",
      ticketId: 10,
      companyId: 1,
      status: "open"
    }
  });
}

describe("SendOneSignalPushNotificationService — API responses", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    getSettings.mockReset();
    (logger.info as jest.Mock).mockClear();
    (logger.warn as jest.Mock).mockClear();
    getSettings.mockResolvedValue({
      enabled: true,
      appId: "app-test",
      restApiKey: "rest-key-test"
    });
  });

  it("recipients > 0 → success", async () => {
    axiosPost.mockResolvedValue({
      status: 200,
      data: { id: "n-ok", recipients: 2 }
    });
    const result = await sendBasic();
    expect(result.success).toBe(true);
    expect(result.apiRecipients).toBe(2);
    expect(result.notificationId).toBe("n-ok");
    expect(result.externalUserIds).toEqual(["25"]);
  });

  it("HTTP 200 com recipients = 0 → não é sucesso", async () => {
    axiosPost.mockResolvedValue({
      status: 200,
      data: { id: "n-zero", recipients: 0 }
    });
    const result = await sendBasic();
    expect(result.attempted).toBe(true);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("zero_recipients");
    expect(result.apiRecipients).toBe(0);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("HTTP 400 → onesignal_bad_request", async () => {
    axiosPost.mockRejectedValue({
      response: { status: 400, data: { errors: ["bad"] } }
    });
    const result = await sendBasic();
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("onesignal_bad_request");
    expect(result.httpStatus).toBe(400);
  });

  it("HTTP 401 → onesignal_auth_error", async () => {
    axiosPost.mockRejectedValue({
      response: { status: 401, data: { errors: ["auth"] } }
    });
    const result = await sendBasic();
    expect(result.errorCode).toBe("onesignal_auth_error");
  });

  it("HTTP 403 → onesignal_auth_error", async () => {
    axiosPost.mockRejectedValue({
      response: { status: 403, data: { errors: ["forbidden"] } }
    });
    const result = await sendBasic();
    expect(result.errorCode).toBe("onesignal_auth_error");
  });

  it("HTTP 429 → onesignal_rate_limited", async () => {
    axiosPost.mockRejectedValue({
      response: { status: 429, data: { errors: ["rate"] } }
    });
    const result = await sendBasic();
    expect(result.errorCode).toBe("onesignal_rate_limited");
  });

  it("timeout → onesignal_timeout", async () => {
    axiosPost.mockRejectedValue({
      code: "ECONNABORTED",
      message: "timeout of 15000ms exceeded"
    });
    const result = await sendBasic();
    expect(result.errorCode).toBe("onesignal_timeout");
    expect(result.success).toBe(false);
  });

  it("config incompleta → skipped, sem chamada HTTP", async () => {
    getSettings.mockResolvedValue({
      enabled: true,
      appId: "",
      restApiKey: ""
    });
    const result = await sendBasic();
    expect(axiosPost).not.toHaveBeenCalled();
    expect(result.skipped).toBe("disabled_or_incomplete_config");
    expect(result.attempted).toBe(false);
  });

  it("IDs numéricos viram string no payload", async () => {
    axiosPost.mockResolvedValue({
      status: 200,
      data: { id: "n1", recipients: 1 }
    });
    await SendOneSignalPushNotificationService({
      eventType: "ticket_message_inbound",
      preferenceCategory: "message",
      companyId: 1,
      ticketId: 10,
      recipientUserIds: [25, 26],
      title: "t",
      body: "b",
      data: {
        type: "ticket_message",
        companyId: 1,
        ticketId: 10,
        status: "open"
      }
    });
    expect(axiosPost.mock.calls[0][1].include_aliases.external_id).toEqual([
      "25",
      "26"
    ]);
  });

  it("teste dirigido usa o mesmo serviço (sem rota HTTP)", async () => {
    axiosPost.mockResolvedValue({
      status: 200,
      data: { id: "test-1", recipients: 1 }
    });
    const result = await DispatchDirectedOneSignalTestPushService({
      companyId: 1,
      userId: 25
    });
    expect(result.success).toBe(true);
    expect(axiosPost.mock.calls[0][1].include_aliases.external_id).toEqual([
      "25"
    ]);
    expect(axiosPost.mock.calls[0][1].data.type).toBe(
      "onesignal_directed_test"
    );
  });
});
