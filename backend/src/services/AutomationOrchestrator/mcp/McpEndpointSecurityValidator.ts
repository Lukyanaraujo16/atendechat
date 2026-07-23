import { lookup } from "dns/promises";
import { getMcpConfig } from "./McpConfig";
import { McpTransportType } from "../../../config/automationMcpConstants";

const PRIVATE_IP_RE =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.|::1$|fc|fd|fe80)/i;

export type EndpointSecurityResult = {
  allowed: boolean;
  reasonCodes: string[];
  resolvedHost?: string;
  protocol?: string;
};

/**
 * McpEndpointSecurityValidator — SSRF / transport guards.
 */
export function validateMcpEndpoint(input: {
  companyId: number;
  transportType: McpTransportType;
  endpoint?: string | null;
  command?: string | null;
  isSuperAdmin?: boolean;
}): EndpointSecurityResult {
  const cfg = getMcpConfig(input.companyId);
  const reasonCodes: string[] = [];

  if (!cfg.allowedTransports.includes(input.transportType)) {
    return {
      allowed: false,
      reasonCodes: ["ERR_MCP_TRANSPORT_NOT_ALLOWED"]
    };
  }

  if (input.transportType === "STDIO") {
    if (!cfg.stdioEnabled || !input.isSuperAdmin) {
      return {
        allowed: false,
        reasonCodes: ["ERR_MCP_TRANSPORT_NOT_ALLOWED", "stdio_restricted"]
      };
    }
    if (!input.command || /[;&|`$]/.test(input.command)) {
      return {
        allowed: false,
        reasonCodes: ["ERR_MCP_TRANSPORT_NOT_ALLOWED", "stdio_command_invalid"]
      };
    }
    return { allowed: true, reasonCodes: [] };
  }

  if (!input.endpoint) {
    return { allowed: false, reasonCodes: ["ERR_MCP_CONNECTION_FAILED", "endpoint_required"] };
  }

  let url: URL;
  try {
    url = new URL(input.endpoint);
  } catch {
    return { allowed: false, reasonCodes: ["ERR_MCP_CONNECTION_FAILED", "endpoint_invalid"] };
  }

  if (!["https:", "http:"].includes(url.protocol)) {
    return {
      allowed: false,
      reasonCodes: ["ERR_MCP_TRANSPORT_NOT_ALLOWED", "protocol_not_allowed"],
      protocol: url.protocol
    };
  }

  const host = url.hostname.toLowerCase();
  if (cfg.blockedHosts.map(h => h.toLowerCase()).includes(host)) {
    return {
      allowed: false,
      reasonCodes: ["ERR_MCP_POLICY_DENIED", "host_blocked"],
      resolvedHost: host
    };
  }

  if (!cfg.allowPrivateNetworks && PRIVATE_IP_RE.test(host)) {
    return {
      allowed: false,
      reasonCodes: ["ERR_MCP_POLICY_DENIED", "private_network_blocked"],
      resolvedHost: host
    };
  }

  return {
    allowed: true,
    reasonCodes,
    resolvedHost: host,
    protocol: url.protocol
  };
}

export async function validateMcpEndpointResolved(input: {
  companyId: number;
  transportType: McpTransportType;
  endpoint?: string | null;
  command?: string | null;
  isSuperAdmin?: boolean;
}): Promise<EndpointSecurityResult> {
  const base = validateMcpEndpoint(input);
  if (!base.allowed || !input.endpoint || input.transportType === "STDIO") {
    return base;
  }
  const cfg = getMcpConfig(input.companyId);
  try {
    const url = new URL(input.endpoint);
    const records = await lookup(url.hostname, { all: true });
    for (const r of records) {
      if (!cfg.allowPrivateNetworks && PRIVATE_IP_RE.test(r.address)) {
        return {
          allowed: false,
          reasonCodes: ["ERR_MCP_POLICY_DENIED", "resolved_private_ip"],
          resolvedHost: r.address
        };
      }
      if (cfg.blockedHosts.includes(r.address)) {
        return {
          allowed: false,
          reasonCodes: ["ERR_MCP_POLICY_DENIED", "resolved_blocked_ip"],
          resolvedHost: r.address
        };
      }
    }
  } catch {
    // DNS failure — allow config validation but mark warning via reason
    base.reasonCodes.push("dns_lookup_skipped_or_failed");
  }
  return base;
}

export default { validateMcpEndpoint, validateMcpEndpointResolved };
