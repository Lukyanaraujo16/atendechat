import {
  AUTOMATION_CAPABILITY_KEYS,
  AUTOMATION_FUTURE_CAPABILITY_KEYS,
  AutomationCapabilityId
} from "../../config/automationOrchestratorConstants";

export type CapabilityDefinition = {
  id: AutomationCapabilityId;
  name: string;
  description: string;
  category: string;
  future: boolean;
  experimental: boolean;
  deprecated: boolean;
};

const capabilityRegistry = new Map<string, CapabilityDefinition>();

function seedDefaults(): void {
  if (capabilityRegistry.size > 0) return;

  const builtin: Array<[AutomationCapabilityId, string, string]> = [
    ["planner", "Planner", "Planejamento e finalização de execução"],
    ["classification", "Classification", "Classificação de intenção"],
    ["knowledge", "Knowledge", "Recuperação de conhecimento"],
    ["ai_generation", "AI Generation", "Geração de resposta com IA"],
    ["chatbot", "Chatbot", "Execução de chatbot"],
    ["flows", "Flows", "Execução de fluxos"],
    ["handoff", "Human Handoff", "Transferência para humano"],
    ["send_message", "Send Message", "Envio de mensagens"],
    ["integrations", "Integrations", "Integrações externas"],
    ["wait", "Wait", "Espera por mensagem"]
  ];

  for (const [id, name, description] of builtin) {
    capabilityRegistry.set(id, {
      id,
      name,
      description,
      category: "core",
      future: false,
      experimental: false,
      deprecated: false
    });
  }

  const futures: Array<[string, string, string]> = [
    ["future.http", "HTTP", "Chamadas HTTP genéricas"],
    ["future.erp", "ERP", "Integração ERP"],
    ["future.mcp", "MCP", "Model Context Protocol"],
    ["future.payment", "Payments", "Pagamentos"],
    ["future.webhook", "Webhooks", "Webhooks de saída"],
    ["future.crm", "CRM", "CRM / deals"],
    ["future.inventory", "Inventory", "Estoque"],
    ["future.calendar", "Calendar", "Agenda"]
  ];

  for (const [id, name, description] of futures) {
    capabilityRegistry.set(id, {
      id,
      name,
      description,
      category: "future",
      future: true,
      experimental: true,
      deprecated: false
    });
  }
}

export function ensureCapabilityRegistrySeeded(): void {
  seedDefaults();
}

export function registerCapability(def: CapabilityDefinition): void {
  seedDefaults();
  capabilityRegistry.set(def.id, def);
}

export function getCapability(
  id: AutomationCapabilityId
): CapabilityDefinition | undefined {
  seedDefaults();
  return capabilityRegistry.get(String(id));
}

export function listCapabilities(opts?: {
  includeFuture?: boolean;
}): CapabilityDefinition[] {
  seedDefaults();
  const includeFuture = opts?.includeFuture !== false;
  return Array.from(capabilityRegistry.values()).filter(
    c => includeFuture || !c.future
  );
}

export function listCoreCapabilityIds(): string[] {
  return [...AUTOMATION_CAPABILITY_KEYS];
}

export function listFutureCapabilityIds(): string[] {
  return [...AUTOMATION_FUTURE_CAPABILITY_KEYS];
}

export function clearCapabilityRegistry(): void {
  capabilityRegistry.clear();
}

export function hasCapability(id: AutomationCapabilityId): boolean {
  seedDefaults();
  return capabilityRegistry.has(String(id));
}

export default {
  ensureCapabilityRegistrySeeded,
  registerCapability,
  getCapability,
  listCapabilities,
  listCoreCapabilityIds,
  listFutureCapabilityIds,
  clearCapabilityRegistry,
  hasCapability
};
