import { getMcpConfig } from "./McpConfig";
import { NormalizedMcpResult } from "./types";

/**
 * McpResultNormalizer — normaliza conteúdos MCP sem expor segredos.
 */
export function normalizeMcpResult(raw: {
  content?: Array<{ type: string; text?: string; [k: string]: unknown }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  error?: string;
}): NormalizedMcpResult {
  const cfg = getMcpConfig();
  const warnings: string[] = [];
  const resources: Array<Record<string, unknown>> = [];
  const texts: string[] = [];

  for (const part of raw.content || []) {
    if (part.type === "text" && typeof part.text === "string") {
      texts.push(part.text.slice(0, cfg.auditPayloadLimit));
    } else if (part.type === "resource" || part.type === "resource_link") {
      resources.push({
        type: part.type,
        uri: part.uri,
        name: part.name
      });
    } else if (part.type === "image") {
      warnings.push("image_content_omitted");
    }
  }

  const structured = raw.structuredContent
    ? JSON.parse(
        JSON.stringify(raw.structuredContent).slice(0, cfg.auditPayloadLimit)
      )
    : null;

  const isError = raw.isError === true || Boolean(raw.error);
  return {
    success: !isError,
    content: texts.join("\n").slice(0, cfg.auditPayloadLimit),
    structuredData: structured,
    resources,
    warnings,
    error: raw.error || (isError ? "mcp_tool_error" : null),
    isError,
    rawMetadata: {
      contentParts: (raw.content || []).length,
      hasStructured: Boolean(raw.structuredContent)
    }
  };
}

export default { normalizeMcpResult };
