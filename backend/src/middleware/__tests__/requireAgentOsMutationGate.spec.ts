import AppError from "../../errors/AppError";

jest.mock("../../services/PlatformUserPermissionService", () => ({
  hasPlatformPermission: jest.fn()
}));

import { hasPlatformPermission } from "../../services/PlatformUserPermissionService";
import requireAgentOsMutationGate from "../requireAgentOsMutationGate";
import { PLATFORM_PERMISSION_KEYS } from "../../config/platformPermissionConstants";

const hasPerm = hasPlatformPermission as jest.Mock;

function run(req: any): Promise<{ err?: any }> {
  return new Promise(resolve => {
    const res: any = {
      on: (_ev: string, _cb: () => void) => res,
      statusCode: 200
    };
    requireAgentOsMutationGate(req, res, (err?: any) => resolve({ err }));
  });
}

describe("requireAgentOsMutationGate", () => {
  beforeEach(() => {
    hasPerm.mockReset();
  });

  it("GET comum → next sem checar permissão extra", async () => {
    const { err } = await run({
      method: "GET",
      baseUrl: "",
      path: "/automation/observability/dashboard",
      user: { id: "1", companyId: 1 }
    });
    expect(err).toBeUndefined();
    expect(hasPerm).not.toHaveBeenCalled();
  });

  it("GET replay → exige agentOS.replay.execute", async () => {
    hasPerm.mockResolvedValue(true);
    const { err } = await run({
      method: "GET",
      baseUrl: "",
      path: "/automation/orchestrator/executions/9/replay",
      user: { id: "1", companyId: 1 },
      params: { id: "9" }
    });
    expect(err).toBeUndefined();
    expect(hasPerm).toHaveBeenCalledWith(
      1,
      PLATFORM_PERMISSION_KEYS.AGENTOS_REPLAY_EXECUTE
    );
  });

  it("POST rollout → exige rollout.manage; só view falha", async () => {
    hasPerm.mockResolvedValue(false);
    const { err } = await run({
      method: "POST",
      baseUrl: "",
      path: "/automation/rollout/transition",
      user: { id: "1", companyId: 1 }
    });
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe("ERR_PLATFORM_PERMISSION_DENIED");
    expect(hasPerm).toHaveBeenCalledWith(
      1,
      PLATFORM_PERMISSION_KEYS.AGENTOS_ROLLOUT_MANAGE
    );
  });

  it("POST genérico → console.manage", async () => {
    hasPerm.mockResolvedValue(true);
    const { err } = await run({
      method: "POST",
      baseUrl: "",
      path: "/automation/tools/test/x",
      user: { id: "2", companyId: 3 }
    });
    expect(err).toBeUndefined();
    expect(hasPerm).toHaveBeenCalledWith(
      2,
      PLATFORM_PERMISSION_KEYS.AGENTOS_CONSOLE_MANAGE
    );
  });

  it("POST emergency-stop → production.manage", async () => {
    hasPerm.mockResolvedValue(true);
    await run({
      method: "POST",
      path: "/automation/emergency-stop",
      baseUrl: "",
      user: { id: "2", companyId: 3 }
    });
    expect(hasPerm).toHaveBeenCalledWith(
      2,
      PLATFORM_PERMISSION_KEYS.AGENTOS_PRODUCTION_MANAGE
    );
  });
});
