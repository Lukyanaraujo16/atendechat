jest.mock("../../../models/PlatformUserPermission", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findAll: jest.fn()
  }
}));

import PlatformUserPermission from "../../../models/PlatformUserPermission";
import {
  hasPlatformPermission,
  listEnabledPlatformPermissions
} from "../index";

const findOne = PlatformUserPermission.findOne as jest.Mock;
const findAll = PlatformUserPermission.findAll as jest.Mock;

describe("PlatformUserPermissionService", () => {
  beforeEach(() => {
    findOne.mockReset();
    findAll.mockReset();
  });

  it("grant habilitado retorna true", async () => {
    findOne.mockResolvedValue({ id: 1 });
    await expect(
      hasPlatformPermission(10, "agentOS.console.view")
    ).resolves.toBe(true);
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 10,
          permissionKey: "agentOS.console.view",
          enabled: true
        }
      })
    );
  });

  it("ausência retorna false", async () => {
    findOne.mockResolvedValue(null);
    await expect(
      hasPlatformPermission(10, "agentOS.console.view")
    ).resolves.toBe(false);
  });

  it("row enabled=false não é encontrada (filtro enabled:true) → false", async () => {
    findOne.mockResolvedValue(null);
    await expect(
      hasPlatformPermission(10, "agentOS.console.view")
    ).resolves.toBe(false);
  });

  it("lista retorna somente habilitadas", async () => {
    findAll.mockResolvedValue([
      { permissionKey: "agentOS.console.view" },
      { permissionKey: "agentOS.console.manage" }
    ]);
    await expect(listEnabledPlatformPermissions(7)).resolves.toEqual([
      "agentOS.console.view",
      "agentOS.console.manage"
    ]);
    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7, enabled: true }
      })
    );
  });

  it("userId inválido não mistura usuários / deny", async () => {
    await expect(hasPlatformPermission("x", "agentOS.console.view")).resolves.toBe(
      false
    );
    await expect(listEnabledPlatformPermissions(0)).resolves.toEqual([]);
    expect(findOne).not.toHaveBeenCalled();
    expect(findAll).not.toHaveBeenCalled();
  });

  it("chave desconhecida não recebe acesso por default", async () => {
    findOne.mockResolvedValue(null);
    await expect(
      hasPlatformPermission(1, "agentOS.unknown.permission")
    ).resolves.toBe(false);
  });
});
