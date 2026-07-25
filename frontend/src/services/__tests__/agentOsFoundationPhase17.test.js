/**
 * Fase 1.7 — QA integrado: lacunas e contratos da fundação do Console Técnico.
 */
import api from "../../services/api";
import {
  probeTechnicalConsoleAccess,
  resetTechnicalConsoleAccessCache,
} from "../technicalConsoleAccessProbe";
import {
  AGENTOS_CONSOLE_NAV_ITEMS,
  AGENTOS_CONSOLE_NAV_GROUPS,
} from "../../config/agentOsConsoleNavigation";
import {
  AGENTOS_TECHNICAL_ROUTE_ENTRIES,
  TECHNICAL_CONSOLE_ROOT_PATH,
} from "../../config/agentOsConsoleRoutes";
import { AGENTOS_PLATFORM_PERMISSION_KEYS } from "../../config/agentOsPlatformPermissions";
import {
  canShowTechnicalConsoleNav,
  hasSerializedAgentOsConsoleAccess,
} from "../../utils/agentOsConsoleAccess";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe("Fase 1.7 — foundation QA", () => {
  beforeEach(() => {
    resetTechnicalConsoleAccessCache();
    api.get.mockReset();
  });

  describe("probe cache / logout contract", () => {
    it("reutiliza resultado em memória para o mesmo userId", async () => {
      api.get.mockResolvedValue({ data: { allowed: true } });
      const a = await probeTechnicalConsoleAccess(7);
      const b = await probeTechnicalConsoleAccess(7);
      expect(a.state).toBe("allowed");
      expect(b.state).toBe("allowed");
      expect(api.get).toHaveBeenCalledTimes(1);
    });

    it("resetTechnicalConsoleAccessCache força novo probe (logout/sessão)", async () => {
      api.get
        .mockResolvedValueOnce({ data: { allowed: true } })
        .mockResolvedValueOnce({ data: { allowed: false } });

      await probeTechnicalConsoleAccess(9);
      resetTechnicalConsoleAccessCache();
      const after = await probeTechnicalConsoleAccess(9);

      expect(after.state).toBe("denied");
      expect(api.get).toHaveBeenCalledTimes(2);
    });

    it("troca de userId não reutiliza cache do anterior", async () => {
      api.get
        .mockResolvedValueOnce({ data: { allowed: true } })
        .mockResolvedValueOnce({ data: { allowed: false } });

      const a = await probeTechnicalConsoleAccess(1);
      const b = await probeTechnicalConsoleAccess(2);

      expect(a.state).toBe("allowed");
      expect(b.state).toBe("denied");
      expect(api.get).toHaveBeenCalledTimes(2);
    });

    it("erro de rede é deny-closed (state error)", async () => {
      api.get.mockRejectedValue({ message: "network" });
      const outcome = await probeTechnicalConsoleAccess(3);
      expect(outcome.state).toBe("error");
    });

    it("401/403 do probe são denied", async () => {
      api.get.mockRejectedValue({ response: { status: 403 } });
      expect((await probeTechnicalConsoleAccess(4)).state).toBe("denied");
      resetTechnicalConsoleAccessCache();
      api.get.mockRejectedValue({ response: { status: 401 } });
      expect((await probeTechnicalConsoleAccess(4)).state).toBe("denied");
    });
  });

  describe("navegação canônica", () => {
    it("todo item de nav tem path canônico único e pageKey em entries", () => {
      const paths = AGENTOS_CONSOLE_NAV_ITEMS.map((i) => i.path);
      expect(new Set(paths).size).toBe(paths.length);

      const pageKeys = new Set(
        AGENTOS_TECHNICAL_ROUTE_ENTRIES.map((e) => e.pageKey)
      );
      AGENTOS_CONSOLE_NAV_ITEMS.forEach((item) => {
        expect(item.path.startsWith(TECHNICAL_CONSOLE_ROOT_PATH)).toBe(true);
        expect(pageKeys.has(item.pageKey)).toBe(true);
        expect(item.group).toBeTruthy();
        expect(
          AGENTOS_CONSOLE_NAV_GROUPS.some((g) => g.id === item.group)
        ).toBe(true);
      });
    });

    it("entries legacy → canônico cobrem 18 módulos técnicos", () => {
      expect(AGENTOS_TECHNICAL_ROUTE_ENTRIES).toHaveLength(18);
      expect(AGENTOS_CONSOLE_NAV_ITEMS).toHaveLength(18);
    });
  });

  describe("autorização serializada / supportMode", () => {
    it("admin cliente sem isInternalUser não vê Console", () => {
      const user = {
        id: 1,
        isInternalUser: false,
        profile: "admin",
        platformPermissions: ["agentOS.console.view"],
        supportMode: true,
      };
      expect(hasSerializedAgentOsConsoleAccess(user)).toBe(false);
      expect(canShowTechnicalConsoleNav(user)).toBe(false);
    });

    it("supportMode não altera a condição de interno + view", () => {
      const base = {
        id: 2,
        isInternalUser: true,
        platformPermissions: ["agentOS.console.view"],
      };
      expect(canShowTechnicalConsoleNav({ ...base, supportMode: false })).toBe(
        true
      );
      expect(canShowTechnicalConsoleNav({ ...base, supportMode: true })).toBe(
        true
      );
      const noView = {
        id: 3,
        isInternalUser: true,
        platformPermissions: [],
        supportMode: true,
      };
      expect(canShowTechnicalConsoleNav(noView)).toBe(false);
    });

    it("chaves FE batem com contrato de plataforma", () => {
      expect(AGENTOS_PLATFORM_PERMISSION_KEYS.CONSOLE_VIEW).toBe(
        "agentOS.console.view"
      );
      expect(AGENTOS_PLATFORM_PERMISSION_KEYS.CONSOLE_MANAGE).toBe(
        "agentOS.console.manage"
      );
      expect(AGENTOS_PLATFORM_PERMISSION_KEYS.REPLAY_EXECUTE).toBe(
        "agentOS.replay.execute"
      );
      expect(AGENTOS_PLATFORM_PERMISSION_KEYS.ROLLOUT_MANAGE).toBe(
        "agentOS.rollout.manage"
      );
      expect(AGENTOS_PLATFORM_PERMISSION_KEYS.PRODUCTION_MANAGE).toBe(
        "agentOS.production.manage"
      );
      expect(AGENTOS_PLATFORM_PERMISSION_KEYS.INCIDENTS_MANAGE).toBe(
        "agentOS.incidents.manage"
      );
      expect(AGENTOS_PLATFORM_PERMISSION_KEYS.SECURITY_VIEW).toBe(
        "agentOS.security.view"
      );
    });
  });
});
