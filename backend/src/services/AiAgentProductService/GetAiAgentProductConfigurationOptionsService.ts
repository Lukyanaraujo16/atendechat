import { Request } from "express";
import AiAgent from "../../models/AiAgent";
import AiProviderCredential from "../../models/AiProviderCredential";
import Whatsapp from "../../models/Whatsapp";
import { AiAgentProductConfigurationOptions } from "../../types/aiAgentProduct";
import {
  resolveAiAgentProductAgentContext
} from "./ResolveAiAgentProductContextService";
import {
  assertAiAgentProductConfigurationAccess,
  listAiAgentProductProviderOptions
} from "./aiAgentProductConfigurationHelpers";
import {
  serializeAiAgentProductConfigurationOptions
} from "./serializeAiAgentProduct";

export default async function GetAiAgentProductConfigurationOptionsService(input: {
  companyId: number;
  req?: Request;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<AiAgentProductConfigurationOptions> {
  const companyId = Number(input.companyId);
  await assertAiAgentProductConfigurationAccess({
    companyId,
    req: input.req,
    availability: input.availability
  });

  const agents = await AiAgent.findAll({
    where: { companyId },
    order: [["id", "ASC"]],
    attributes: ["id", "name", "enabled"]
  });

  const resolved = resolveAiAgentProductAgentContext(
    agents.map(a => ({
      id: a.id,
      name: a.name,
      enabled: a.enabled === true,
      hasProvider: false,
      hasInstructions: false,
      explicitlyPaused: false
    }))
  );

  const resolvedAgentId =
    resolved.resolution === "resolved" ? resolved.agent!.id : null;

  const credentials = await AiProviderCredential.findAll({
    where: { companyId },
    order: [["id", "ASC"]],
    attributes: [
      "id",
      "name",
      "provider",
      "apiKeyMasked",
      "enabled",
      "isDefault"
    ]
  });

  const connections = await Whatsapp.findAll({
    where: { companyId },
    order: [["id", "ASC"]],
    attributes: ["id", "name", "status", "aiAgentId"]
  });

  const options: AiAgentProductConfigurationOptions = {
    providers: listAiAgentProductProviderOptions().map(p => ({
      value: p.value,
      label: p.label,
      available: p.available,
      ...(p.unavailableReason
        ? { unavailableReason: p.unavailableReason }
        : {})
    })),
    credentials: credentials.map(c => ({
      ref: String(c.id),
      name: String(c.name || ""),
      provider: String(c.provider || ""),
      maskedKey: String(c.apiKeyMasked || ""),
      enabled: c.enabled === true,
      isDefault: c.isDefault === true
    })),
    connections: connections.map(w => {
      const selected =
        resolvedAgentId != null && w.aiAgentId === resolvedAgentId;
      const eligible =
        w.aiAgentId == null ||
        (resolvedAgentId != null && w.aiAgentId === resolvedAgentId);
      return {
        ref: String(w.id),
        name: String(w.name || "").trim() || "—",
        status: String(w.status || ""),
        selected,
        eligible,
        ineligibleReason: eligible ? null : "already_assigned"
      };
    })
  };

  return serializeAiAgentProductConfigurationOptions(options);
}
