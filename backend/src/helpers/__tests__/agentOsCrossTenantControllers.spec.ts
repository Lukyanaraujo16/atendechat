/**
 * Fase 1.4.1 — controllers: isolamento cross-tenant na borda HTTP.
 */
import AppError from "../../errors/AppError";

jest.mock("../../models/AiAgent", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

const GetIncidentService = jest.fn();
const ListIncidentsService = jest.fn();
const AcknowledgeIncidentService = jest.fn();
const ResolveIncidentService = jest.fn();

jest.mock(
  "../../services/AutomationOrchestrator/production/ProductionAdminServices",
  () => ({
    GetIncidentService: (...a: any[]) => GetIncidentService(...a),
    ListIncidentsService: (...a: any[]) => ListIncidentsService(...a),
    AcknowledgeIncidentService: (...a: any[]) => AcknowledgeIncidentService(...a),
    ResolveIncidentService: (...a: any[]) => ResolveIncidentService(...a)
  })
);

const UpsertLiveFcAgentSettingService = jest.fn();
jest.mock(
  "../../services/AutomationOrchestrator/liveRollout/LiveRolloutAdminServices",
  () => ({
    UpsertLiveFcAgentSettingService: (...a: any[]) =>
      UpsertLiveFcAgentSettingService(...a)
  })
);

import AiAgent from "../../models/AiAgent";
import * as ProductionCtrl from "../../controllers/AutomationProductionController";
import * as LiveCtrl from "../../controllers/AutomationLiveRolloutController";
import {
  __resetAgentOsActionOwnershipIndexForTests,
  rememberCompanyActionId
} from "../agentOsTenantOwnership";
import * as ActionCtrl from "../../controllers/AutomationActionExecutionController";

const GetActionResultService = jest.fn();
const ListActionResultsService = jest.fn();

jest.mock(
  "../../services/AutomationOrchestrator/cognitive/action/ActionExecutionAdminServices",
  () => ({
    GetActionResultService: (...a: any[]) => GetActionResultService(...a),
    ListActionResultsService: (...a: any[]) => ListActionResultsService(...a),
    ExecuteActionService: jest.fn(),
    ListStrategiesService: jest.fn(),
    GetActionExecutionDashboardService: jest.fn(),
    GetActionExecutionConfigService: jest.fn(),
    UpsertActionExecutionConfigService: jest.fn(),
    ReplayActionExecutionService: jest.fn(),
    SimulateActionService: jest.fn(),
    InspectStrategyService: jest.fn()
  })
);

function mockRes() {
  const res: any = {
    statusCode: 200,
    json: jest.fn((body: any) => {
      res.body = body;
      return res;
    })
  };
  return res;
}

describe("agentOs cross-tenant controllers (1.4.1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetAgentOsActionOwnershipIndexForTests();
  });

  describe("incidents", () => {
    it("bloqueia incidente de outro tenant e com companyId null", async () => {
      GetIncidentService.mockResolvedValue({
        id: "inc-b",
        companyId: 99
      });
      const req: any = {
        user: { companyId: 1, id: 7 },
        params: { id: "inc-b" }
      };
      await expect(ProductionCtrl.getIncident(req, mockRes())).rejects.toMatchObject({
        statusCode: 404,
        message: "ERR_NOT_FOUND"
      });
      expect(AcknowledgeIncidentService).not.toHaveBeenCalled();

      GetIncidentService.mockResolvedValue({
        id: "inc-global",
        companyId: null
      });
      await expect(
        ProductionCtrl.getIncident(
          { user: { companyId: 1, id: 7 }, params: { id: "inc-global" } } as any,
          mockRes()
        )
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("ack não muta incidente de outro tenant", async () => {
      GetIncidentService.mockResolvedValue({ id: "x", companyId: 2 });
      await expect(
        ProductionCtrl.ackIncident(
          { user: { companyId: 1, id: 7 }, params: { id: "x" } } as any,
          mockRes()
        )
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(AcknowledgeIncidentService).not.toHaveBeenCalled();
    });

    it("lista só incidents do tenant ativo", async () => {
      ListIncidentsService.mockResolvedValue({
        incidents: [
          { id: "1", companyId: 1 },
          { id: "2", companyId: 2 },
          { id: "3", companyId: null }
        ]
      });
      const res = mockRes();
      await ProductionCtrl.listIncidents(
        { user: { companyId: 1 }, query: {} } as any,
        res
      );
      expect(res.body.incidents.map((i: any) => i.id)).toEqual(["1"]);
    });

    it("permite incidente do tenant ativo", async () => {
      GetIncidentService.mockResolvedValue({ id: "ok", companyId: 1 });
      const res = mockRes();
      await ProductionCtrl.getIncident(
        { user: { companyId: 1, id: 7 }, params: { id: "ok" } } as any,
        res
      );
      expect(res.body).toEqual({ id: "ok", companyId: 1 });
    });
  });

  describe("live agentSetting", () => {
    it("404 se agentId não pertence ao tenant ativo", async () => {
      (AiAgent.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        LiveCtrl.agentSetting(
          {
            user: { companyId: 1, id: 9 },
            params: { agentId: "55" },
            body: { enabled: true }
          } as any,
          mockRes()
        )
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(UpsertLiveFcAgentSettingService).not.toHaveBeenCalled();
    });

    it("prossegue quando AiAgent é do tenant", async () => {
      (AiAgent.findOne as jest.Mock).mockResolvedValue({ id: 55, companyId: 1 });
      UpsertLiveFcAgentSettingService.mockResolvedValue({
        functionCallingLive: true
      });
      const res = mockRes();
      await LiveCtrl.agentSetting(
        {
          user: { companyId: 1, id: 9 },
          params: { agentId: "55" },
          body: { enabled: true }
        } as any,
        res
      );
      expect(AiAgent.findOne).toHaveBeenCalledWith({
        where: { id: 55, companyId: 1 }
      });
      expect(UpsertLiveFcAgentSettingService).toHaveBeenCalled();
      expect(res.body.functionCallingLive).toBe(true);
    });
  });

  describe("action results", () => {
    it("resultById de outro tenant → 404 sem chamar service", async () => {
      rememberCompanyActionId(2, "foreign");
      await expect(
        ActionCtrl.resultById(
          { user: { companyId: 1 }, params: { id: "foreign" } } as any,
          mockRes()
        )
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(GetActionResultService).not.toHaveBeenCalled();
    });

    it("resultById do próprio tenant chama service", async () => {
      rememberCompanyActionId(1, "own");
      GetActionResultService.mockResolvedValue({
        result: { actionId: "own" }
      });
      const res = mockRes();
      await ActionCtrl.resultById(
        { user: { companyId: 1 }, params: { id: "own" } } as any,
        res
      );
      expect(GetActionResultService).toHaveBeenCalledWith({
        companyId: 1,
        id: "own"
      });
    });
  });
});
