/**
 * Catálogo central de funcionalidades por plano (chaves estáveis com notação ponto).
 * Filhos são independentes do pai — cada chave grava em PlanFeatures.
 * `dependsOn` reservado para evolução futura (não aplicado em runtime ainda).
 */

export type FeatureNodeLeaf = {
  label: string;
  /** Chaves de feature que devem estar ativas (futuro) */
  dependsOn?: string[];
};

export type FeatureNodeBranch = {
  label: string;
  children: Record<string, FeatureNodeBranch | FeatureNodeLeaf>;
  dependsOn?: string[];
};

export type FeatureNode = FeatureNodeBranch | FeatureNodeLeaf;

function isBranch(n: FeatureNode): n is FeatureNodeBranch {
  return typeof (n as FeatureNodeBranch).children === "object";
}

export const FEATURES: Record<string, FeatureNode> = {
  dashboard: {
    label: "Dashboard",
    children: {
      main: { label: "Painel principal" },
      reports: { label: "Relatórios" }
    }
  },
  attendance: {
    label: "Atendimento",
    children: {
      inbox: { label: "Caixa de entrada / tickets" },
      kanban: { label: "Kanban" },
      schedules: { label: "Agendamentos (envio)" },
      internal_chat: { label: "Chat interno" }
    }
  },
  automation: {
    label: "Automação",
    children: {
      chatbot: { label: "Chatbot / fluxos" },
      openai: { label: "OpenAI" },
      keywords: { label: "Gatilhos por palavra" },
      integrations: { label: "Integrações de fila" },
      quick_replies: { label: "Respostas rápidas" }
    }
  },
  agenda: {
    label: "Agenda",
    children: {
      calendar: { label: "Calendário / compromissos" },
      appointments: { label: "Agendamentos (horários de envio)" }
    }
  },
  team: {
    label: "Equipe",
    children: {
      users: { label: "Utilizadores" },
      queues: { label: "Setores / filas" },
      groups: { label: "Grupos WhatsApp" },
      ratings: { label: "Avaliações" }
    }
  },
  finance: {
    label: "Financeiro",
    children: {
      subscription: { label: "Subscrição" },
      invoices: { label: "Faturas" }
    }
  },
  campaigns: {
    label: "Campanhas",
    children: {
      sends: { label: "Disparos" },
      lists: { label: "Listas de contatos" }
    }
  },
  contacts: {
    label: "Contatos",
    children: {
      crm: { label: "CRM / etiquetas" },
      files: { label: "Lista de ficheiros" }
    }
  },
  settings: {
    label: "Configurações",
    children: {
      connections: { label: "Conexões WhatsApp" },
      api: { label: "API / mensagens externas" }
    }
  },
  crm: {
    label: "CRM",
    children: {
      pipeline: { label: "Pipeline / oportunidades" }
    }
  }
};

/** Todas as chaves leaf no formato `grupo.filho`. */
export function getAllFeatureKeys(): string[] {
  const keys: string[] = [];
  const walk = (prefix: string, node: FeatureNode) => {
    if (isBranch(node)) {
      for (const [childKey, child] of Object.entries(node.children)) {
        walk(prefix ? `${prefix}.${childKey}` : childKey, child);
      }
    } else if (prefix) {
      keys.push(prefix);
    }
  };
  for (const [rootKey, node] of Object.entries(FEATURES)) {
    walk(rootKey, node);
  }
  return keys;
}
