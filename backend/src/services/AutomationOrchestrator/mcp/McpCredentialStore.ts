import { createHash } from "crypto";
import {
  encryptAiProviderApiKey,
  decryptAiProviderApiKey
} from "../../../helpers/aiProviderCredentialCrypto";
import { McpAuthType } from "../../../config/automationMcpConstants";
import { McpCredential } from "./types";
import { mcpRepository } from "../persistence/repositories/McpRepository";

const credentialsByCompany = new Map<number, Map<string, McpCredential>>();

function table(companyId: number): Map<string, McpCredential> {
  if (!credentialsByCompany.has(companyId)) {
    credentialsByCompany.set(companyId, new Map());
  }
  return credentialsByCompany.get(companyId)!;
}

export function maskSecret(value: string): string {
  const s = String(value || "");
  if (!s) return "";
  if (s.length <= 4) return "****";
  return `${"*".repeat(Math.min(12, s.length - 4))}${s.slice(-4)}`;
}

/**
 * Reutiliza AES-GCM de aiProviderCredentialCrypto — sem duplicar crypto.
 */
export function encryptMcpSecret(plain: string): string {
  return encryptAiProviderApiKey(plain);
}

export function decryptMcpSecret(stored: string): string {
  return decryptAiProviderApiKey(stored);
}

export function createMcpCredential(input: {
  companyId: number;
  name: string;
  authType: McpAuthType;
  payload: Record<string, string>;
  createdBy?: number | null;
}): McpCredential {
  const now = new Date().toISOString();
  const previewSource =
    input.payload.token ||
    input.payload.apiKey ||
    input.payload.password ||
    Object.values(input.payload)[0] ||
    "";
  const cred: McpCredential = {
    id: `mcpcred_${createHash("sha256")
      .update(`${input.companyId}:${input.name}:${Date.now()}`)
      .digest("hex")
      .slice(0, 12)}`,
    companyId: input.companyId,
    name: input.name,
    authType: input.authType,
    encryptedPayload: encryptMcpSecret(JSON.stringify(input.payload)),
    maskedPreview: maskSecret(previewSource),
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    metadata: {}
  };
  table(input.companyId).set(cred.id, cred);
  mcpRepository.upsertCredentialFireAndForget(input.companyId, cred as any);
  return { ...cred };
}

export function getMcpCredential(
  companyId: number,
  id: string
): McpCredential | null {
  const c = table(companyId).get(id);
  return c ? { ...c } : null;
}

export function listMcpCredentials(companyId: number): Array<
  Omit<McpCredential, "encryptedPayload"> & { encryptedPayload: undefined }
> {
  return Array.from(table(companyId).values()).map(c => ({
    ...c,
    encryptedPayload: undefined
  }));
}

export function resolveMcpCredentialHeaders(
  companyId: number,
  credentialId: string | null
): Record<string, string> {
  if (!credentialId) return {};
  const cred = table(companyId).get(credentialId);
  if (!cred) throw new Error("ERR_MCP_CREDENTIAL_INVALID");
  const payload = JSON.parse(decryptMcpSecret(cred.encryptedPayload)) as Record<
    string,
    string
  >;
  cred.lastUsedAt = new Date().toISOString();
  table(companyId).set(cred.id, cred);

  switch (cred.authType) {
    case "BEARER_TOKEN":
      return { Authorization: `Bearer ${payload.token || ""}` };
    case "API_KEY_HEADER":
      return {
        [payload.headerName || "X-API-Key"]: payload.apiKey || ""
      };
    case "BASIC_AUTH": {
      const basic = Buffer.from(
        `${payload.username || ""}:${payload.password || ""}`
      ).toString("base64");
      return { Authorization: `Basic ${basic}` };
    }
    case "CUSTOM_HEADERS":
      return { ...payload };
    default:
      return {};
  }
}

export function __resetMcpCredentialsForTests(): void {
  credentialsByCompany.clear();
}

export default {
  createMcpCredential,
  getMcpCredential,
  listMcpCredentials,
  resolveMcpCredentialHeaders
};
