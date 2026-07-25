/**
 * Fase 1.6 — permissões, 403 de ação, readonly helpers.
 */
import {
  AGENTOS_PLATFORM_PERMISSION_KEYS,
  canViewAgentOsConsole,
  canManageAgentOsConsole,
  canExecuteAgentOsReplay,
  canManageAgentOsRollout,
  canManageAgentOsProduction,
  canManageAgentOsIncidents,
  canViewAgentOsSecurity,
  getAgentOsConsoleActionGrants,
  hasPlatformPermission,
} from "../../config/agentOsPlatformPermissions";
import {
  isAgentOsPermissionDenied,
  toastAgentOsActionError,
} from "../../utils/agentOsActionError";
import { i18n } from "../../translate/i18n";

jest.mock("react-toastify", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("../../errors/toastError", () => jest.fn());

const { toast } = require("react-toastify");
const toastError = require("../../errors/toastError");

function userWith(...keys) {
  return {
    id: 1,
    isInternalUser: true,
    platformPermissions: keys,
  };
}

describe("Fase 1.6 — helpers de permissão", () => {
  const keys = AGENTOS_PLATFORM_PERMISSION_KEYS;

  it("reconhece cada grant individualmente", () => {
    expect(canViewAgentOsConsole(userWith(keys.CONSOLE_VIEW))).toBe(true);
    expect(canManageAgentOsConsole(userWith(keys.CONSOLE_MANAGE))).toBe(true);
    expect(canExecuteAgentOsReplay(userWith(keys.REPLAY_EXECUTE))).toBe(true);
    expect(canManageAgentOsRollout(userWith(keys.ROLLOUT_MANAGE))).toBe(true);
    expect(canManageAgentOsProduction(userWith(keys.PRODUCTION_MANAGE))).toBe(
      true
    );
    expect(canManageAgentOsIncidents(userWith(keys.INCIDENTS_MANAGE))).toBe(
      true
    );
    expect(canViewAgentOsSecurity(userWith(keys.SECURITY_VIEW))).toBe(true);
  });

  it("nega permissão ausente", () => {
    const u = userWith(keys.CONSOLE_VIEW);
    expect(canManageAgentOsConsole(u)).toBe(false);
    expect(canExecuteAgentOsReplay(u)).toBe(false);
    expect(canManageAgentOsRollout(u)).toBe(false);
    expect(canManageAgentOsProduction(u)).toBe(false);
    expect(canManageAgentOsIncidents(u)).toBe(false);
    expect(canViewAgentOsSecurity(u)).toBe(false);
    expect(hasPlatformPermission(u, keys.CONSOLE_MANAGE)).toBe(false);
  });

  it("getAgentOsConsoleActionGrants marca somente leitura", () => {
    const grants = getAgentOsConsoleActionGrants(
      userWith(keys.CONSOLE_VIEW)
    );
    expect(grants.canView).toBe(true);
    expect(grants.readOnlyManage).toBe(true);
    expect(grants.canReplay).toBe(false);
  });
});

describe("Fase 1.6 — toastAgentOsActionError", () => {
  beforeEach(() => {
    toast.error.mockClear();
    toastError.mockClear();
  });

  it("403 plataforma → mensagem segura sem permission key", () => {
    toastAgentOsActionError({
      response: {
        status: 403,
        data: { error: "ERR_PLATFORM_PERMISSION_DENIED" },
      },
    });
    expect(toast.error).toHaveBeenCalled();
    const msg = toast.error.mock.calls[0][0];
    expect(msg).toBe(i18n.t("technicalConsole.actionDenied.message"));
    expect(String(msg)).not.toMatch(/agentOS\./);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("outros erros delegam a toastError", () => {
    const err = { response: { status: 500, data: { error: "ERR_X" } } };
    toastAgentOsActionError(err);
    expect(toastError).toHaveBeenCalledWith(err);
  });

  it("isAgentOsPermissionDenied", () => {
    expect(
      isAgentOsPermissionDenied({
        response: { status: 403, data: { error: "ERR_PLATFORM_PERMISSION_DENIED" } },
      })
    ).toBe(true);
    expect(isAgentOsPermissionDenied({ response: { status: 404 } })).toBe(false);
  });
});

describe("Fase 1.6 — traduções empty/confirm", () => {
  it("chaves empty e actionDenied existem", () => {
    [
      "technicalConsole.actionDenied.message",
      "technicalConsole.empty.executions",
      "technicalConsole.empty.evidence",
      "technicalConsole.empty.incidents",
      "technicalConsole.empty.actions",
      "technicalConsole.empty.memory",
      "technicalConsole.confirm.killConfirm",
      "technicalConsole.confirm.emergencyConfirm",
    ].forEach((key) => {
      const t = i18n.t(key);
      expect(t).toBeTruthy();
      expect(t).not.toBe(key);
    });
  });
});
