import { Request, Response } from "express";
import AppError from "../errors/AppError";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

function userIdOrNull(req: Request): number | null {
  const id = req.user?.id;
  if (id == null) return null;
  return typeof id === "number" ? id : Number(id);
}

function mapErr(err: unknown): never {
  if (err instanceof AppError) throw err;
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith("ERR_AGENT_")) {
    throw new AppError(msg.split(":")[0], 400, msg);
  }
  throw err;
}

async function S() {
  return import(
    "../services/AutomationOrchestrator/multiAgent/admin/MultiAgentAdminServices"
  );
}

export const createAgent = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.CreateAgentService({
        companyId: companyIdOrThrow(req),
        userId: userIdOrNull(req),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listAgents = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.ListAgentsService({ companyId: companyIdOrThrow(req) })
  );
};

export const getAgent = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.GetAgentService({
        companyId: companyIdOrThrow(req),
        id: String(req.params.id)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const updateAgent = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.UpdateAgentService({
        companyId: companyIdOrThrow(req),
        id: String(req.params.id),
        userId: userIdOrNull(req),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const deleteAgent = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.DeleteAgentService({
        companyId: companyIdOrThrow(req),
        id: String(req.params.id)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

const statusHandler = (status: any) => async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.AgentStatusService({
        companyId: companyIdOrThrow(req),
        id: String(req.params.id),
        status,
        userId: userIdOrNull(req)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const activateAgent = statusHandler("ACTIVE");
export const deactivateAgent = statusHandler("INACTIVE");
export const suspendAgent = statusHandler("SUSPENDED");
export const archiveAgent = statusHandler("ARCHIVED");

export const duplicateAgent = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.DuplicateAgentService({
        companyId: companyIdOrThrow(req),
        id: String(req.params.id),
        userId: userIdOrNull(req),
        name: req.body?.name
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listVersions = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.ListAgentVersionsService({
      companyId: companyIdOrThrow(req),
      id: String(req.params.id)
    })
  );
};

export const getVersion = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.GetAgentVersionService({
        companyId: companyIdOrThrow(req),
        id: String(req.params.id),
        version: String(req.params.version)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const healthAgent = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.HealthAgentService({
        companyId: companyIdOrThrow(req),
        id: String(req.params.id),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const simulateRouting = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.SimulateRoutingService({
        companyId: companyIdOrThrow(req),
        userId: userIdOrNull(req),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const selectRouting = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.SelectRoutingService({
        companyId: companyIdOrThrow(req),
        userId: userIdOrNull(req),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listRoutingDecisions = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.ListRoutingDecisionsService({ companyId: companyIdOrThrow(req) })
  );
};

export const getRoutingDecision = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.GetRoutingDecisionService({
        companyId: companyIdOrThrow(req),
        id: String(req.params.id)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const upsertSticky = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.UpsertStickyService({
      companyId: companyIdOrThrow(req),
      body: req.body || {}
    })
  );
};

export const listSticky = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.ListStickyService({ companyId: companyIdOrThrow(req) })
  );
};

export const deleteSticky = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.DeleteStickyService({
      companyId: companyIdOrThrow(req),
      id: String(req.params.id)
    })
  );
};

export const previewDelegation = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.PreviewDelegationService({
        companyId: companyIdOrThrow(req),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const simulateDelegation = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.SimulateDelegationService({
        companyId: companyIdOrThrow(req),
        userId: userIdOrNull(req),
        body: req.body || {},
        approved: req.body?.approved === true
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const approveDelegation = async (req: Request, res: Response) => {
  req.body = { ...(req.body || {}), approved: true };
  return simulateDelegation(req, res);
};

export const listDelegations = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.ListDelegationsService({ companyId: companyIdOrThrow(req) })
  );
};

export const getDelegation = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.GetDelegationService({
        companyId: companyIdOrThrow(req),
        id: String(req.params.id)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const previewHandoff = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.PreviewHandoffService({
        companyId: companyIdOrThrow(req),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const simulateHandoff = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.SimulateHandoffService({
        companyId: companyIdOrThrow(req),
        userId: userIdOrNull(req),
        body: req.body || {},
        approved: req.body?.approved === true
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const approveHandoff = async (req: Request, res: Response) => {
  req.body = { ...(req.body || {}), approved: true };
  return simulateHandoff(req, res);
};

export const listHandoffs = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.ListHandoffsService({ companyId: companyIdOrThrow(req) })
  );
};

export const getHandoff = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.GetHandoffService({
        companyId: companyIdOrThrow(req),
        id: String(req.params.id)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const createCoordination = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.CreateCoordinationService({
        companyId: companyIdOrThrow(req),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const simulateCoordination = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.SimulateCoordinationService({
        companyId: companyIdOrThrow(req),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listCoordination = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.ListCoordinationService({ companyId: companyIdOrThrow(req) })
  );
};

export const getCoordination = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.GetCoordinationService({
        companyId: companyIdOrThrow(req),
        id: String(req.params.id)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.SendAgentMessageService({
        companyId: companyIdOrThrow(req),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listMessages = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.ListMessagesService({ companyId: companyIdOrThrow(req) })
  );
};

export const getMessage = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.GetMessageService({
        companyId: companyIdOrThrow(req),
        id: String(req.params.id)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const createIntervention = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.CreateInterventionService({
      companyId: companyIdOrThrow(req),
      body: req.body || {}
    })
  );
};

export const listInterventions = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.ListInterventionsService({ companyId: companyIdOrThrow(req) })
  );
};

export const getIntervention = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.GetInterventionService({
        companyId: companyIdOrThrow(req),
        id: String(req.params.id)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const resolveIntervention = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.ResolveInterventionService({
        companyId: companyIdOrThrow(req),
        id: String(req.params.id),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listSessions = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.ListSessionsService({ companyId: companyIdOrThrow(req) })
  );
};

export const getSession = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.GetSessionService({
        companyId: companyIdOrThrow(req),
        id: String(req.params.id)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const metrics = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.GetMetricsService({ companyId: companyIdOrThrow(req) })
  );
};

export const dashboard = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.GetDashboardService({ companyId: companyIdOrThrow(req) })
  );
};

export const replay = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.GetReplayService({
      companyId: companyIdOrThrow(req),
      id: String(req.params.id)
    })
  );
};

export const audit = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.GetAuditService({ companyId: companyIdOrThrow(req) })
  );
};

export const getConfig = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.GetConfigService({ companyId: companyIdOrThrow(req) })
  );
};

export const putConfig = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.PutConfigService({
        companyId: companyIdOrThrow(req),
        config: req.body?.config || req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const simulateFullFlow = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.SimulateFullFlowService({
        companyId: companyIdOrThrow(req),
        userId: userIdOrNull(req),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const simulateMemory = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.SimulateMemoryPolicyService({
        companyId: companyIdOrThrow(req),
        agentId: String(req.body?.agentId || ""),
        scope: String(req.body?.scope || "AGENT_PRIVATE"),
        memoryType: req.body?.memoryType
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const simulateFallback = async (req: Request, res: Response) => {
  const api = await S();
  return res.json(
    await api.SimulateFallbackService({
      companyId: companyIdOrThrow(req),
      body: req.body || {}
    })
  );
};

export const isolateFailure = async (req: Request, res: Response) => {
  try {
    const api = await S();
    return res.json(
      await api.IsolateFailureService({
        companyId: companyIdOrThrow(req),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};
