/**
 * Catálogo de features por plano (espelha backend/src/config/features.ts).
 * Chaves estáveis: grupo.filho
 */

export const FEATURES = {
  dashboard: {
    label: "Dashboard",
    children: {
      main: { label: "Painel principal" },
      reports: { label: "Relatórios" },
    },
  },
  attendance: {
    label: "Atendimento",
    children: {
      inbox: { label: "Caixa de entrada / tickets" },
      kanban: { label: "Kanban" },
      schedules: { label: "Agendamentos (envio)" },
      internal_chat: { label: "Chat interno" },
    },
  },
  automation: {
    label: "Automação",
    children: {
      chatbot: { label: "Chatbot / fluxos" },
      openai: { label: "OpenAI" },
      keywords: { label: "Gatilhos por palavra" },
      integrations: { label: "Integrações de fila" },
      quick_replies: { label: "Respostas rápidas" },
    },
  },
  agenda: {
    label: "Agenda",
    children: {
      calendar: { label: "Calendário / compromissos" },
      appointments: { label: "Agendamentos (horários de envio)" },
    },
  },
  team: {
    label: "Equipe",
    children: {
      users: { label: "Utilizadores" },
      queues: { label: "Setores / filas" },
      groups: { label: "Grupos WhatsApp" },
      ratings: { label: "Avaliações" },
    },
  },
  finance: {
    label: "Financeiro",
    children: {
      subscription: { label: "Subscrição" },
      invoices: { label: "Faturas" },
    },
  },
  campaigns: {
    label: "Campanhas",
    children: {
      sends: { label: "Disparos" },
      lists: { label: "Listas de contactos" },
    },
  },
  contacts: {
    label: "Contactos",
    children: {
      crm: { label: "CRM / etiquetas" },
      files: { label: "Lista de ficheiros" },
    },
  },
  settings: {
    label: "Configurações",
    children: {
      connections: { label: "Conexões WhatsApp" },
      api: { label: "API / mensagens externas" },
    },
  },
};

function isBranch(n) {
  return n && typeof n.children === "object";
}

export function getAllFeatureKeys() {
  const keys = [];
  const walk = (prefix, node) => {
    if (isBranch(node)) {
      Object.entries(node.children).forEach(([childKey, child]) => {
        walk(prefix ? `${prefix}.${childKey}` : childKey, child);
      });
    } else if (prefix) {
      keys.push(prefix);
    }
  };
  Object.entries(FEATURES).forEach(([rootKey, node]) => {
    walk(rootKey, node);
  });
  return keys;
}

export function getFeatureLabel(fullKey) {
  const parts = fullKey.split(".");
  let node = FEATURES[parts[0]];
  if (!node) return fullKey;
  for (let i = 1; i < parts.length; i += 1) {
    if (isBranch(node) && node.children[parts[i]]) {
      node = node.children[parts[i]];
    } else {
      return fullKey;
    }
  }
  return node.label || fullKey;
}
