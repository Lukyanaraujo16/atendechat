/**
 * Catálogo central de funcionalidades por plano (chaves estáveis com notação ponto).
 * Filhos são independentes do pai — cada chave grava em PlanFeatures.
 * `dependsOn` reservado para evolução futura (não aplicado em runtime ainda).
 */

export type FeatureNodeLeaf = {
  label: string;
  /** Texto de ajuda na UI de planos (Super Admin). */
  description?: string;
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
      main: {
        label: "Painel principal",
        description: "Visão geral de indicadores e atividades da operação."
      },
      reports: {
        label: "Relatórios",
        description: "Relatórios e métricas de atendimento."
      }
    }
  },
  attendance: {
    label: "Atendimento",
    children: {
      inbox: {
        label: "Conversas / caixa de entrada",
        description: "Atendimento de conversas e tickets do WhatsApp."
      },
      kanban: {
        label: "Kanban",
        description: "Quadro visual para organizar atendimentos por etapa."
      },
      schedules: {
        label: "Envio programado",
        description: "Agenda envios de mensagens em data e hora definidas."
      },
      internal_chat: {
        label: "Chat interno",
        description: "Chat entre membros da equipe, fora do WhatsApp."
      }
    }
  },
  automation: {
    label: "Automação de atendimento",
    children: {
      chatbot: {
        label: "Fluxos e chatbot",
        description: "Automação de atendimento com fluxos e chatbot."
      },
      openai: {
        label: "Inteligência artificial (OpenAI)",
        description: "Prompts e respostas assistidas por IA."
      },
      keywords: {
        label: "Gatilhos por palavra-chave",
        description: "Dispara fluxos quando o contato envia palavras específicas."
      },
      integrations: {
        label: "Integrações de setor",
        description: "Integrações externas ligadas aos setores de atendimento."
      },
      quick_replies: {
        label: "Respostas rápidas",
        description: "Mensagens prontas para usar durante o atendimento."
      }
    }
  },
  agenda: {
    label: "Agenda",
    children: {
      calendar: {
        label: "Calendário e compromissos",
        description: "Agenda de compromissos e visualização em calendário."
      },
      appointments: {
        label: "Horários de envio (agenda)",
        description: "Configura horários permitidos para envios agendados."
      }
    }
  },
  team: {
    label: "Equipe",
    children: {
      users: {
        label: "Membros da equipe",
        description: "Cadastro e gestão de usuários da empresa."
      },
      queues: {
        label: "Setores e filas",
        description: "Setores de atendimento e distribuição de conversas."
      },
      groups: {
        label: "Grupos WhatsApp",
        description: "Gestão de grupos da conexão WhatsApp."
      },
      ratings: {
        label: "Avaliações",
        description: "Pesquisas de satisfação após o atendimento."
      }
    }
  },
  finance: {
    label: "Financeiro",
    children: {
      subscription: {
        label: "Assinatura",
        description: "Gestão da assinatura do plano."
      },
      invoices: {
        label: "Faturas",
        description: "Consulta de faturas e cobranças."
      }
    }
  },
  campaigns: {
    label: "Campanhas",
    children: {
      sends: {
        label: "Disparos em massa",
        description: "Envie mensagens para vários contatos ao mesmo tempo."
      },
      lists: {
        label: "Listas de destinatários",
        description:
          "Permite criar listas de contatos para envio de campanhas."
      }
    }
  },
  contacts: {
    label: "Contatos",
    children: {
      tags: {
        label: "Tags de contatos",
        description:
          "Cria e gerencia tags para organizar contatos e atendimentos."
      },
      files: {
        label: "Biblioteca de arquivos",
        description: "Permite gerenciar arquivos do sistema."
      }
    }
  },
  crm: {
    label: "CRM",
    children: {
      pipeline: {
        label: "Funil de vendas",
        description: "CRM com funil de oportunidades e etapas de venda."
      }
    }
  },
  settings: {
    label: "Configurações",
    children: {
      connections: {
        label: "Conexões WhatsApp",
        description: "Conexões e sessões do WhatsApp da empresa."
      },
      api: {
        label: "API de mensagens",
        description: "Envio de mensagens por API externa."
      },
      instagram_integration: {
        label: "Instagram",
        description:
          "Permite conectar Instagram e atender Directs."
      }
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
