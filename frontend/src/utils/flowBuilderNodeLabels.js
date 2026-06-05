const FLOW_NODE_TYPE_LABELS = {
  start: "Início",
  message: "Texto",
  menu: "Menu",
  question: "Pergunta",
  waitForInteraction: "Aguardar interação",
  ticket: "Ticket",
  sector: "Setor",
  closeTicket: "Encerrar ticket",
  tag: "Tag Kanban",
  attendant: "Atendente",
  typebot: "TypeBot",
  openai: "OpenAI",
  httpRequest: "HTTP Request",
  flowUp: "FlowUp",
  condition: "Condição",
  randomizer: "Randomizador",
  interval: "Intervalo",
  notification: "Notificação",
  blacklist: "Blacklist",
  img: "Imagem",
  audio: "Áudio",
  video: "Vídeo",
  singleBlock: "Conteúdo",
};

export function flowNodeTypeLabel(type) {
  return FLOW_NODE_TYPE_LABELS[type] || type || "—";
}

export function flowNodeSummaryText(node) {
  const type = node?.type || "unknown";
  const typeLabel = flowNodeTypeLabel(type);
  const d = node?.data || {};
  const extra = d.label || d.message || d.text || "";
  const snippet = extra ? `: ${String(extra).slice(0, 72)}` : "";
  return `${typeLabel}${snippet}`;
}

export function flowNodeCountFromRecord(flow) {
  const nodes = flow?.flow?.nodes;
  return Array.isArray(nodes) ? nodes.length : 0;
}
