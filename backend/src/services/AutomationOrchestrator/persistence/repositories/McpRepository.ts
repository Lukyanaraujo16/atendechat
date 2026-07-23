import { Transaction } from "sequelize";
import AutomationMcpServer from "../../../../models/AutomationMcpServer";
import AutomationMcpCredential from "../../../../models/AutomationMcpCredential";
import AutomationMcpTool from "../../../../models/AutomationMcpTool";
import {
  assertCompanyId,
  getAgentOsPersistenceBackend,
  persistAsync
} from "../persistenceUtils";

export class McpRepository {
  async upsertServer(
    companyId: number,
    server: Record<string, unknown>,
    transaction?: Transaction
  ) {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return server;
    await AutomationMcpServer.upsert(
      {
        id: String(server.id),
        companyId,
        name: String(server.name || ""),
        slug: String(server.slug || server.id),
        status: String(server.status || "DRAFT"),
        transport: String(server.transport || "stdio"),
        payload: server
      } as any,
      { transaction }
    );
    return server;
  }

  upsertServerFireAndForget(companyId: number, server: Record<string, unknown>) {
    persistAsync(() => this.upsertServer(companyId, server), "mcp.server");
  }

  async upsertCredential(
    companyId: number,
    cred: Record<string, unknown>,
    transaction?: Transaction
  ) {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return cred;
    await AutomationMcpCredential.upsert(
      {
        id: String(cred.id),
        companyId,
        name: String(cred.name || ""),
        authType: String(cred.authType || "none"),
        encryptedPayload: String(cred.encryptedPayload || ""),
        maskedPreview: (cred.maskedPreview as string) || null,
        payload: {
          createdAt: cred.createdAt,
          updatedAt: cred.updatedAt,
          createdBy: cred.createdBy
        },
        createdBy: (cred.createdBy as number) ?? null
      } as any,
      { transaction }
    );
    return cred;
  }

  upsertCredentialFireAndForget(
    companyId: number,
    cred: Record<string, unknown>
  ) {
    persistAsync(() => this.upsertCredential(companyId, cred), "mcp.credential");
  }

  async upsertTool(
    companyId: number,
    tool: Record<string, unknown>,
    transaction?: Transaction
  ) {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return tool;
    const id = String(tool.id || `${tool.serverId}::${tool.name}`);
    await AutomationMcpTool.upsert(
      {
        id,
        companyId,
        serverId: String(tool.serverId),
        name: String(tool.name),
        payload: tool,
        schemaHash: (tool.schemaHash as string) || null
      } as any,
      { transaction }
    );
    return tool;
  }

  upsertToolFireAndForget(companyId: number, tool: Record<string, unknown>) {
    persistAsync(() => this.upsertTool(companyId, tool), "mcp.tool");
  }

  async listServers(companyId: number) {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return [];
    const rows = await AutomationMcpServer.findAll({ where: { companyId } });
    return rows.map(r => ({ ...(r.payload || {}), id: r.id, companyId }));
  }

  async softDeleteServer(companyId: number, id: string) {
    assertCompanyId(companyId);
    if (getAgentOsPersistenceBackend() !== "sequelize") return false;
    return (await AutomationMcpServer.destroy({ where: { companyId, id } })) > 0;
  }
}

export const mcpRepository = new McpRepository();
export default mcpRepository;
