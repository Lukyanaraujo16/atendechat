/**
 * Carrega o SDK MCP em runtime sem forçar o TypeScript 4.x
 * a parsear tipagens Zod v4 do pacote oficial.
 */
/* eslint-disable @typescript-eslint/no-var-requires, global-require */

export type LoadedMcpClient = {
  listTools: () => Promise<{ tools: unknown[] }>;
  callTool: (args: {
    name: string;
    arguments?: Record<string, unknown>;
  }) => Promise<unknown>;
  close: () => Promise<void>;
};

export async function connectOfficialMcpClient(input: {
  endpoint: string;
  headers: Record<string, string>;
  transportType: string;
}): Promise<LoadedMcpClient> {
  const req = eval("require") as NodeRequire;

  const { Client } = req("@modelcontextprotocol/sdk/client/index.js");
  const client = new Client({
    name: "atendechat-mcp-runtime",
    version: "2.7.0"
  });

  if (input.transportType === "STREAMABLE_HTTP") {
    const { StreamableHTTPClientTransport } = req(
      "@modelcontextprotocol/sdk/client/streamableHttp.js"
    );
    const transport = new StreamableHTTPClientTransport(new URL(input.endpoint), {
      requestInit: { headers: input.headers }
    });
    await client.connect(transport);
  } else if (input.transportType === "SSE_LEGACY") {
    const { SSEClientTransport } = req(
      "@modelcontextprotocol/sdk/client/sse.js"
    );
    const transport = new SSEClientTransport(new URL(input.endpoint), {
      requestInit: { headers: input.headers }
    });
    await client.connect(transport);
  } else {
    throw new Error("ERR_MCP_TRANSPORT_NOT_ALLOWED");
  }

  return {
    listTools: () => client.listTools(),
    callTool: args => client.callTool(args),
    close: () => client.close()
  };
}
