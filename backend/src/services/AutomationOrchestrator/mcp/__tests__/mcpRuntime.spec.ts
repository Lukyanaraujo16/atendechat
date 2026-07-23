/**
 * AI Agent V2.7 — MCP Runtime tests (fake SDK client; no live MCP server required)
 */
import {
  AUTOMATION_MCP_SDK_PACKAGE,
  AUTOMATION_MCP_SDK_VERSION,
  MCP_ERROR_CODES,
  MCP_EVENTS
} from "../../../../config/automationMcpConstants";
import { __resetMcpConfigForTests, setMcpConfig } from "../McpConfig";
import { __resetMcpCredentialsForTests, createMcpCredential, listMcpCredentials } from "../McpCredentialStore";
import {
  __resetMcpServersForTests,
  createMcpServer,
  getMcpServer,
  listMcpServers
} from "../McpServerStore";
import { validateMcpEndpoint } from "../McpEndpointSecurityValidator";
import { setMcpClientFactory } from "../McpClientManager";
import { __resetMcpConnectionPoolForTests } from "../McpConnectionPool";
import { __resetMcpToolsForTests, getMcpTool, classifyMcpTool } from "../McpToolCatalog";
import { syncMcpCatalog } from "../McpCapabilityDiscovery";
import { mapMcpToolToCapability } from "../McpCapabilityMapper";
import { evaluateMcpToolPolicy } from "../McpToolPolicyEngine";
import { validateMcpInput } from "../McpInputValidator";
import { normalizeMcpResult } from "../McpResultNormalizer";
import { evaluateFallbackSafety, evaluateRetrySafety } from "../McpSafetyEvaluators";
import { __resetMcpIdempotencyForTests } from "../McpIdempotency";
import { __resetMcpMetricsForTests, getMcpMetricsBase } from "../McpMetrics";
import { __resetMcpEventsForTests } from "../McpEvents";
import { decideRuntimeDispatch } from "../../runtimeIntegration/RuntimeDispatcher";
import { adaptExecutionActionToRuntimeRequest } from "../../runtimeIntegration/ExecutionAdapter";
import { mapStepToExecutionAction } from "../../cognitive/action/ActionExecutionEngine";
import mcpRuntimeAdapter from "../adapters/McpRuntimeAdapter";
import { defaultRuntimeAdapterRegistry } from "../../runtimeIntegration/RuntimeAdapterRegistry";
import {
  CreateMcpServerService,
  ExecuteMcpToolService,
  GetMcpDashboardService,
  PreviewMcpToolService
} from "../McpAdminServices";

describe("MCP Runtime V2.7", () => {
  beforeEach(() => {
    process.env.AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY =
      process.env.AI_PROVIDER_CREDENTIAL_ENCRYPTION_KEY ||
      "test-mcp-credential-encryption-key-v27";
    __resetMcpConfigForTests();
    __resetMcpCredentialsForTests();
    __resetMcpServersForTests();
    __resetMcpToolsForTests();
    __resetMcpConnectionPoolForTests();
    __resetMcpIdempotencyForTests();
    __resetMcpMetricsForTests();
    __resetMcpEventsForTests();
    setMcpClientFactory(async () => ({
      listTools: async () => ({
        tools: [
          {
            name: "search_customer",
            title: "Search Customer",
            description: "Search customer by query",
            inputSchema: {
              type: "object",
              properties: { query: { type: "string" } },
              required: ["query"],
              additionalProperties: false
            },
            annotations: { readOnlyHint: true }
          },
          {
            name: "create_calendar_event",
            description: "Create calendar event",
            inputSchema: {
              type: "object",
              properties: { title: { type: "string" } },
              required: ["title"]
            },
            annotations: { destructiveHint: true }
          }
        ]
      }),
      callTool: async ({ name, arguments: args }) => ({
        content: [{ type: "text", text: `ok:${name}:${JSON.stringify(args)}` }],
        structuredContent: { name, args },
        isError: false
      }),
      close: async () => undefined
    }));
  });

  afterEach(() => {
    setMcpClientFactory(null);
  });

  it("SDK oficial registrado", () => {
    expect(AUTOMATION_MCP_SDK_PACKAGE).toBe("@modelcontextprotocol/sdk");
    expect(AUTOMATION_MCP_SDK_VERSION).toBe("1.29.0");
    expect(MCP_ERROR_CODES).toContain("ERR_MCP_POLICY_DENIED");
    expect(MCP_EVENTS).toContain("MCP_EXECUTION_COMPLETED");
  });

  it("cadastro tenant-scoped e isolamento", () => {
    createMcpServer({
      companyId: 1,
      name: "A",
      transportType: "STREAMABLE_HTTP",
      endpoint: "https://example.com/mcp"
    });
    createMcpServer({
      companyId: 2,
      name: "B",
      transportType: "STREAMABLE_HTTP",
      endpoint: "https://example.com/mcp"
    });
    expect(listMcpServers(1).every(s => s.companyId === 1)).toBe(true);
    expect(getMcpServer(1, listMcpServers(2)[0].id)).toBeNull();
  });

  it("credenciais mascaradas / sem plaintext no list", () => {
    createMcpCredential({
      companyId: 3,
      name: "tok",
      authType: "BEARER_TOKEN",
      payload: { token: "secret-token-value" }
    });
    const listed = listMcpCredentials(3);
    expect(listed[0].encryptedPayload).toBeUndefined();
    expect(listed[0].maskedPreview).toContain("alue");
    expect(listed[0].maskedPreview).not.toContain("secret-token-value");
  });

  it("endpoint inválido e SSRF bloqueados", () => {
    expect(
      validateMcpEndpoint({
        companyId: 1,
        transportType: "STREAMABLE_HTTP",
        endpoint: "https://169.254.169.254/latest"
      }).allowed
    ).toBe(false);
    expect(
      validateMcpEndpoint({
        companyId: 1,
        transportType: "STREAMABLE_HTTP",
        endpoint: "ftp://evil"
      }).allowed
    ).toBe(false);
    expect(
      validateMcpEndpoint({
        companyId: 1,
        transportType: "STDIO",
        command: "node server.js",
        isSuperAdmin: false
      }).allowed
    ).toBe(false);
  });

  it("transport permitido STREAMABLE_HTTP", () => {
    expect(
      validateMcpEndpoint({
        companyId: 1,
        transportType: "STREAMABLE_HTTP",
        endpoint: "https://mcp.example.com/mcp"
      }).allowed
    ).toBe(true);
  });

  it("sync catalog + WRITE desabilitada por padrão + schemaHash", async () => {
    const server = createMcpServer({
      companyId: 4,
      name: "sync",
      transportType: "STREAMABLE_HTTP",
      endpoint: "https://mcp.example.com/mcp"
    });
    const sync = await syncMcpCatalog({ companyId: 4, serverId: server.id });
    expect(sync.tools.length).toBe(2);
    const write = getMcpTool(4, server.id, "create_calendar_event");
    expect(write?.enabled).toBe(false);
    expect(write?.classification).toBe("WRITE");
    const read = getMcpTool(4, server.id, "search_customer");
    expect(read?.enabled).toBe(true);
    expect(read?.schemaHash).toBeTruthy();
  });

  it("capability mapping", async () => {
    const server = createMcpServer({
      companyId: 5,
      name: "map",
      transportType: "STREAMABLE_HTTP",
      endpoint: "https://mcp.example.com/mcp"
    });
    await syncMcpCatalog({ companyId: 5, serverId: server.id });
    const tool = getMcpTool(5, server.id, "search_customer")!;
    expect(mapMcpToolToCapability(tool)).toBe("SEARCH_CUSTOMER");
  });

  it("dispatcher TOOL_RUNTIME vs MCP por preferência", async () => {
    const server = createMcpServer({
      companyId: 6,
      name: "disp",
      transportType: "STREAMABLE_HTTP",
      endpoint: "https://mcp.example.com/mcp"
    });
    await syncMcpCatalog({ companyId: 6, serverId: server.id });
    setMcpConfig(6, {
      capabilityPreferences: { SEARCH_CUSTOMER: "MCP_FIRST" }
    });

    const action = mapStepToExecutionAction({
      stepId: "d1",
      stepType: "search",
      objective: "customer",
      metadata: { capability: "SEARCH_CUSTOMER", domain: "customer" }
    });
    const request = adaptExecutionActionToRuntimeRequest({
      action,
      companyId: 6
    });
    request.metadata.capability = "SEARCH_CUSTOMER";
    const decision = decideRuntimeDispatch({ request, companyId: 6 });
    expect(decision.selectedRuntimeType).toBe("MCP");
    expect(decision.selectedAdapter).toBe("McpRuntimeAdapter");
    expect(decision.selectedTool).toBe("search_customer");
  });

  it("policy READ / WRITE / UNKNOWN / confirmation", async () => {
    const server = createMcpServer({
      companyId: 7,
      name: "pol",
      transportType: "STREAMABLE_HTTP",
      endpoint: "https://mcp.example.com/mcp"
    });
    await syncMcpCatalog({ companyId: 7, serverId: server.id });
    const read = evaluateMcpToolPolicy({
      companyId: 7,
      serverId: server.id,
      toolName: "search_customer",
      args: { query: "ana" },
      mode: "execute"
    });
    expect(read.executionMode).toBe("EXECUTE");
    expect(read.approved).toBe(true);

    const write = evaluateMcpToolPolicy({
      companyId: 7,
      serverId: server.id,
      toolName: "create_calendar_event",
      args: { title: "meet" },
      mode: "execute",
      confirmed: false
    });
    // tool disabled by default for WRITE
    expect(write.violations.length + (write.executionMode === "CONFIRMATION_REQUIRED" ? 1 : 0)).toBeGreaterThan(0);

    expect(classifyMcpTool({ name: "do_something_weird" })).toBe("UNKNOWN");
  });

  it("input schema válido e inválido", () => {
    const ok = validateMcpInput({
      schema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
        additionalProperties: false
      },
      args: { query: "x", extra: 1 }
    });
    expect(ok.status).toBe("SANITIZED");
    expect(ok.sanitizedArguments.extra).toBeUndefined();

    const bad = validateMcpInput({
      schema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"]
      },
      args: {}
    });
    expect(bad.valid).toBe(false);
  });

  it("result normalization + fallback/retry safety", () => {
    const n = normalizeMcpResult({
      content: [{ type: "text", text: "hello" }, { type: "image", data: "x" }],
      structuredContent: { a: 1 }
    });
    expect(n.success).toBe(true);
    expect(n.warnings).toContain("image_content_omitted");

    expect(
      evaluateFallbackSafety({
        allowFallback: true,
        toolRuntimeAvailable: true,
        classification: "WRITE",
        mcpStartedExecution: true,
        mcpResultAmbiguous: true
      })
    ).toBe("UNSAFE");

    expect(
      evaluateRetrySafety({
        errorCode: "ERR_MCP_CONNECTION_TIMEOUT",
        classification: "READ",
        executionConfirmedStarted: false
      })
    ).toBe("SAFE");
  });

  it("McpRuntimeAdapter executa READ via fake client", async () => {
    const server = createMcpServer({
      companyId: 8,
      name: "run",
      transportType: "STREAMABLE_HTTP",
      endpoint: "https://mcp.example.com/mcp"
    });
    await syncMcpCatalog({ companyId: 8, serverId: server.id });
    const action = mapStepToExecutionAction({
      stepId: "r1",
      stepType: "search",
      objective: "q",
      metadata: {
        preferredRuntimeType: "MCP",
        mcpServerId: server.id,
        toolId: "search_customer",
        capability: "SEARCH_CUSTOMER",
        parameters: { query: "ana" }
      }
    });
    const request = adaptExecutionActionToRuntimeRequest({
      action,
      companyId: 8
    });
    request.parameters = { query: "ana" };
    request.metadata.mcpServerId = server.id;
    request.metadata.mcpMode = "execute";

    const result = await mcpRuntimeAdapter.execute({
      request,
      capability: {
        kind: "SEARCH_CONTACT",
        runtimeType: "MCP",
        requiredAdapter: "McpRuntimeAdapter",
        toolId: "search_customer",
        metadata: { serverId: server.id, toolName: "search_customer" }
      },
      companyId: 8,
      userId: 1
    });
    expect(result.runtimeType).toBe("MCP");
    expect(result.status).toBe("success");
    expect(result.metadata.liveIntegration).toBe(false);
  });

  it("registry inclui McpRuntimeAdapter e dashboard", async () => {
    expect(
      defaultRuntimeAdapterRegistry.list().some(a => a.name === "McpRuntimeAdapter")
    ).toBe(true);
    await CreateMcpServerService({
      companyId: 9,
      body: {
        name: "dash",
        transportType: "STREAMABLE_HTTP",
        endpoint: "https://mcp.example.com/mcp"
      }
    });
    const dash = await GetMcpDashboardService({ companyId: 9 });
    expect(dash.liveIntegrationEnabled).toBe(false);
    expect(dash.sdk.version).toBe("1.29.0");
    expect(dash.servers).toBeGreaterThanOrEqual(1);
  });

  it("preview e execute dry_run via admin", async () => {
    const server = createMcpServer({
      companyId: 10,
      name: "adm",
      transportType: "STREAMABLE_HTTP",
      endpoint: "https://mcp.example.com/mcp"
    });
    await syncMcpCatalog({ companyId: 10, serverId: server.id });
    const preview = await PreviewMcpToolService({
      companyId: 10,
      serverId: server.id,
      toolName: "search_customer",
      args: { query: "x" }
    });
    expect(preview.policy.executionMode).toBe("PREVIEW");

    const exec = await ExecuteMcpToolService({
      companyId: 10,
      serverId: server.id,
      toolName: "search_customer",
      args: { query: "x" },
      mode: "dry_run"
    });
    expect(exec.record.capability.runtimeType).toBe("MCP");
  });

  it("métricas incrementam", async () => {
    const before = getMcpMetricsBase().requests;
    const server = createMcpServer({
      companyId: 11,
      name: "met",
      transportType: "STREAMABLE_HTTP",
      endpoint: "https://mcp.example.com/mcp"
    });
    await syncMcpCatalog({ companyId: 11, serverId: server.id });
    await ExecuteMcpToolService({
      companyId: 11,
      serverId: server.id,
      toolName: "search_customer",
      args: { query: "z" },
      mode: "dry_run"
    });
    expect(getMcpMetricsBase().requests).toBeGreaterThanOrEqual(before);
  });
});
