import { Request } from "express";
import AppError from "../../errors/AppError";
import AiProviderCredential from "../../models/AiProviderCredential";
import Whatsapp from "../../models/Whatsapp";
import { AiAgentProductConfigurationOptions } from "../../types/aiAgentProduct";
import {
  assertAiAgentProductConfigurationAccess,
  listAiAgentProductProviderOptions
} from "./aiAgentProductConfigurationHelpers";
import {
  AI_AGENT_PRODUCT_PROVIDER_CAPABILITIES,
  listModelsForCommercialProvider
} from "./aiAgentProductProviderCapabilities";
import {
  serializeAiAgentProductConfigurationOptions
} from "./serializeAiAgentProduct";
import {
  resolveAiAgentProductAgentForOperation
} from "./aiAgentProductAgentRef";

export default async function GetAiAgentProductConfigurationOptionsService(input: {
  companyId: number;
  req?: Request;
  agentRef?: unknown;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
}): Promise<AiAgentProductConfigurationOptions> {
  const companyId = Number(input.companyId);
  await assertAiAgentProductConfigurationAccess({
    companyId,
    req: input.req,
    availability: input.availability
  });

  let resolvedAgentId: number | null = null;
  try {
    const scoped = await resolveAiAgentProductAgentForOperation({
      companyId,
      agentRef: input.agentRef
    });
    if (scoped.kind === "resolved") {
      resolvedAgentId = scoped.agentId;
    }
  } catch (err) {
    // Sem agentRef e ≥2: opções company-scoped ainda úteis (credenciais/conexões).
    // selected/eligible ficam neutros (nenhum selected).
    if (
      !(err instanceof AppError) ||
      err.message !== "ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED"
    ) {
      throw err;
    }
  }

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
    models: AI_AGENT_PRODUCT_PROVIDER_CAPABILITIES.flatMap(capability =>
      listModelsForCommercialProvider(capability.provider).map(model => ({
        value: model,
        label: model,
        provider: capability.provider
      }))
    ),
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
