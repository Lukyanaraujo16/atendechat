import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { AUTOMATION_MCP_FEATURE_KEY } from "../config/automationMcpConstants";
import { assertAgentOsPlanFeature } from "../services/AutomationOrchestrator/security/AgentOsPlanGate";

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

function isSuperAdmin(req: Request): boolean {
  return Boolean((req.user as any)?.super || (req.user as any)?.profile === "super");
}

async function assertMcpPlan(companyId: number): Promise<void> {
  await assertAgentOsPlanFeature(companyId, AUTOMATION_MCP_FEATURE_KEY);
}

function mapErr(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith("ERR_MCP_")) {
    throw new AppError(msg.split(":")[0], 400, msg);
  }
  throw err;
}

export const createServer = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  await assertMcpPlan(companyId);
  try {
    const { CreateMcpServerService } = await import(
      "../services/AutomationOrchestrator/mcp/McpAdminServices"
    );
    return res.json(
      await CreateMcpServerService({
        companyId,
        userId: userIdOrNull(req),
        isSuperAdmin: isSuperAdmin(req),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listServers = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { ListMcpServersService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(await ListMcpServersService({ companyId }));
};

export const getServer = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { GetMcpServerService } = await import(
      "../services/AutomationOrchestrator/mcp/McpAdminServices"
    );
    return res.json(
      await GetMcpServerService({ companyId, id: String(req.params.id) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const updateServer = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { UpdateMcpServerService } = await import(
      "../services/AutomationOrchestrator/mcp/McpAdminServices"
    );
    return res.json(
      await UpdateMcpServerService({
        companyId,
        id: String(req.params.id),
        body: req.body || {},
        isSuperAdmin: isSuperAdmin(req)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const deleteServer = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { DeleteMcpServerService } = await import(
      "../services/AutomationOrchestrator/mcp/McpAdminServices"
    );
    return res.json(
      await DeleteMcpServerService({ companyId, id: String(req.params.id) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const testServer = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { TestMcpConnectionService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(
    await TestMcpConnectionService({
      companyId,
      id: String(req.params.id),
      isSuperAdmin: isSuperAdmin(req)
    })
  );
};

export const healthServer = testServer;

export const connectServer = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { ConnectMcpServerService } = await import(
      "../services/AutomationOrchestrator/mcp/McpAdminServices"
    );
    return res.json(
      await ConnectMcpServerService({
        companyId,
        id: String(req.params.id),
        isSuperAdmin: isSuperAdmin(req)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const disconnectServer = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { DisconnectMcpServerService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(
    await DisconnectMcpServerService({ companyId, id: String(req.params.id) })
  );
};

export const syncServer = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { SyncMcpCatalogService } = await import(
      "../services/AutomationOrchestrator/mcp/McpAdminServices"
    );
    return res.json(
      await SyncMcpCatalogService({
        companyId,
        id: String(req.params.id),
        isSuperAdmin: isSuperAdmin(req)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listServerTools = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { ListMcpToolsService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(
    await ListMcpToolsService({
      companyId,
      serverId: String(req.params.id)
    })
  );
};

export const listTools = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { ListMcpToolsService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(
    await ListMcpToolsService({
      companyId,
      serverId: req.query.serverId ? String(req.query.serverId) : undefined
    })
  );
};

export const getTool = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { GetMcpToolService } = await import(
      "../services/AutomationOrchestrator/mcp/McpAdminServices"
    );
    return res.json(
      await GetMcpToolService({
        companyId,
        serverId: String(req.params.serverId),
        toolName: String(req.params.toolName)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const updateTool = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { UpdateMcpToolService } = await import(
      "../services/AutomationOrchestrator/mcp/McpAdminServices"
    );
    return res.json(
      await UpdateMcpToolService({
        companyId,
        serverId: String(req.params.serverId),
        toolName: String(req.params.toolName),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const preview = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { PreviewMcpToolService } = await import(
      "../services/AutomationOrchestrator/mcp/McpAdminServices"
    );
    return res.json(
      await PreviewMcpToolService({
        companyId,
        serverId: String(req.body?.serverId || ""),
        toolName: String(req.body?.toolName || ""),
        args: req.body?.args
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const execute = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { ExecuteMcpToolService } = await import(
      "../services/AutomationOrchestrator/mcp/McpAdminServices"
    );
    return res.json(
      await ExecuteMcpToolService({
        companyId,
        userId: userIdOrNull(req),
        serverId: String(req.body?.serverId || ""),
        toolName: String(req.body?.toolName || ""),
        args: req.body?.args,
        confirmed: req.body?.confirmed === true,
        mode: req.body?.mode || "execute"
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const confirm = async (req: Request, res: Response) => {
  req.body = { ...(req.body || {}), confirmed: true, mode: "confirm" };
  return execute(req, res);
};

export const executions = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { ListMcpExecutionsService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(await ListMcpExecutionsService({ companyId }));
};

export const executionById = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { GetMcpExecutionService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(
    await GetMcpExecutionService({ companyId, id: String(req.params.id) })
  );
};

export const metrics = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { GetMcpMetricsService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(await GetMcpMetricsService({ companyId }));
};

export const dashboard = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { GetMcpDashboardService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(await GetMcpDashboardService({ companyId }));
};

export const getConfig = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { GetMcpConfigService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(await GetMcpConfigService({ companyId }));
};

export const putConfig = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { UpsertMcpConfigService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(
    await UpsertMcpConfigService({
      companyId,
      config: req.body?.config || req.body || {}
    })
  );
};

export const createCredential = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { CreateMcpCredentialService } = await import(
      "../services/AutomationOrchestrator/mcp/McpAdminServices"
    );
    return res.json(
      await CreateMcpCredentialService({
        companyId,
        userId: userIdOrNull(req),
        body: req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listCredentials = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { ListMcpCredentialsService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(await ListMcpCredentialsService({ companyId }));
};

export const simulatePolicy = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { SimulateMcpPolicyService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(
    await SimulateMcpPolicyService({
      companyId,
      serverId: String(req.body?.serverId || ""),
      toolName: String(req.body?.toolName || ""),
      args: req.body?.args,
      confirmed: req.body?.confirmed,
      mode: req.body?.mode
    })
  );
};

export const simulateFallback = async (req: Request, res: Response) => {
  const { SimulateMcpFallbackService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(await SimulateMcpFallbackService(req.body || {}));
};

export const normalizeResult = async (req: Request, res: Response) => {
  const { NormalizeMcpResultService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(
    await NormalizeMcpResultService({ raw: req.body?.raw || req.body || {} })
  );
};

export const inspectDispatch = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  const { InspectMcpDispatchService } = await import(
    "../services/AutomationOrchestrator/mcp/McpAdminServices"
  );
  return res.json(
    await InspectMcpDispatchService({
      companyId,
      capability: req.body?.capability || req.body?.metadata?.capability,
      operation: req.body?.operation || req.body?.objective
    })
  );
};

export const replay = async (req: Request, res: Response) => {
  const companyId = companyIdOrThrow(req);
  try {
    const { ReplayMcpRuntimeService } = await import(
      "../services/AutomationOrchestrator/mcp/McpAdminServices"
    );
    return res.json(
      await ReplayMcpRuntimeService({
        companyId,
        userId: userIdOrNull(req),
        serverId: String(req.body?.serverId || req.params.id || ""),
        toolName: String(req.body?.toolName || ""),
        args: req.body?.args,
        persistKnowledge: req.body?.persistKnowledge === true
      })
    );
  } catch (e) {
    mapErr(e);
  }
};
