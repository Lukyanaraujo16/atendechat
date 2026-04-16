/**
 * Simulação local do Flow Builder (sem WhatsApp, sem API).
 * Percorre nós/arestas do React Flow com regras aproximadas ao runtime.
 */

/** @param {import('react-flow-renderer').Edge[]} edges */
export function pickNextNode(edges, sourceId, sourceHandle) {
  if (!edges || !sourceId) return null;
  const out = edges.filter((e) => e.source === sourceId);
  if (!out.length) return null;
  const want =
    sourceHandle === undefined || sourceHandle === null
      ? null
      : String(sourceHandle);
  if (want === null) {
    const noH = out.find((e) => !e.sourceHandle);
    return (noH || out[0]).target;
  }
  const exact = out.find((e) => String(e.sourceHandle || "") === want);
  if (exact) return exact.target;
  const loose = out.find((e) => !e.sourceHandle);
  return (loose || out[0]).target;
}

export function findStartNodeId(nodes) {
  const n = nodes.find((x) => x.type === "start");
  return n ? n.id : null;
}

function resolveLeftValue(rule, ctx) {
  const { source, field } = rule;
  if (source === "context") {
    if (field === "body") return String(ctx.lastUserMessage || "");
    if (field === "isFirstInteraction") return ctx.messageCount <= 1;
    if (field === "hasQueue") return false;
    if (field === "hasUser") return false;
  }
  if (source === "contact") {
    if (field === "name") return ctx.mockContactName || "Visitante";
    if (field === "number") return ctx.mockNumber || "";
    if (field === "email") return "";
  }
  return undefined;
}

function evalOperator(left, operator, rightRaw) {
  const right = rightRaw != null ? String(rightRaw) : "";
  const lStr = left == null ? "" : String(left);
  const lNum = Number(left);
  const rNum = Number(right);
  switch (operator) {
    case "equals":
      return lStr === right;
    case "notEquals":
      return lStr !== right;
    case "contains":
      return lStr.includes(right);
    case "notContains":
      return !lStr.includes(right);
    case "startsWith":
      return lStr.startsWith(right);
    case "endsWith":
      return lStr.endsWith(right);
    case "exists":
      return left !== undefined && left !== null;
    case "notExists":
      return left === undefined || left === null;
    case "isEmpty":
      return lStr.trim() === "";
    case "isNotEmpty":
      return lStr.trim() !== "";
    case "greaterThan":
      return !Number.isNaN(lNum) && !Number.isNaN(rNum) && lNum > rNum;
    case "greaterThanOrEqual":
      return !Number.isNaN(lNum) && !Number.isNaN(rNum) && lNum >= rNum;
    case "lessThan":
      return !Number.isNaN(lNum) && !Number.isNaN(rNum) && lNum < rNum;
    case "lessThanOrEqual":
      return !Number.isNaN(lNum) && !Number.isNaN(rNum) && lNum <= rNum;
    case "in": {
      const parts = right.split(",").map((s) => s.trim());
      return parts.includes(lStr);
    }
    case "notIn": {
      const parts = right.split(",").map((s) => s.trim());
      return !parts.includes(lStr);
    }
    case "isTrue":
      return left === true || left === "true" || lStr === "1";
    case "isFalse":
      return left === false || left === "false" || lStr === "0";
    case "matchesRegex":
      try {
        return new RegExp(right, "i").test(lStr);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Avalia condição no simulador. Retorna true/false ou null se precisar escolha manual (regras não suportadas).
 * @param {object} nodeData
 * @param {{ lastUserMessage: string, messageCount: number, mockContactName?: string, mockNumber?: string }} ctx
 */
export function evaluateConditionSimulation(nodeData, ctx) {
  const mode = nodeData?.mode === "any" ? "any" : "all";
  const rules = Array.isArray(nodeData?.rules) ? nodeData.rules : [];
  if (!rules.length) return false;

  let unsupported = false;
  const results = rules.map((rule) => {
    if (!rule || !rule.operator) return false;
    if (rule.source === "variable" || rule.source === "ticket") {
      unsupported = true;
      return false;
    }
    const left = resolveLeftValue(rule, ctx);
    const needs = ![
      "exists",
      "notExists",
      "isEmpty",
      "isNotEmpty",
      "isTrue",
      "isFalse",
    ].includes(rule.operator);
    const ok = evalOperator(
      left,
      rule.operator,
      needs ? rule.value : undefined
    );
    return ok;
  });

  if (unsupported) return null;
  return mode === "any" ? results.some(Boolean) : results.every(Boolean);
}

const BOT = "bot";
const USER = "user";

/**
 * Executa passos automáticos até precisar de input ou fim.
 * @returns {{ messages: {from:string,text:string}[], wait: null|'menu'|'text'|'condition', payload?: object, nextNodeId: string|null }}
 */
export function runSimulationStep(nodes, edges, fromNodeId, ctx) {
  const messages = [];
  let id = fromNodeId;
  let guard = 0;
  const nodeById = (nid) => nodes.find((n) => n.id === nid);

  while (id && guard++ < 300) {
    const node = nodeById(id);
    if (!node) {
      messages.push({ from: BOT, text: "⚠ Nó não encontrado." });
      return { messages, wait: null, nextNodeId: null, payload: null };
    }
    const d = node.data || {};
    const t = node.type;

    if (t === "start") {
      id = pickNextNode(edges, id, "a");
      continue;
    }

    if (t === "message") {
      messages.push({ from: BOT, text: String(d.label || "").trim() || "(vazio)" });
      id = pickNextNode(edges, id, "a");
      continue;
    }

    if (t === "interval") {
      const sec = d.sec != null ? Number(d.sec) : 0;
      messages.push({
        from: BOT,
        text:
          sec > 0
            ? `⏱ Pausa de ${sec}s (simulada — sem espera real).`
            : "⏱ Intervalo (simulado).",
      });
      id = pickNextNode(edges, id, "a");
      continue;
    }

    if (t === "menu") {
      messages.push({
        from: BOT,
        text: String(d.message || "Escolha uma opção:").trim(),
      });
      const opts = Array.isArray(d.arrayOption) ? d.arrayOption : [];
      return {
        messages,
        wait: "menu",
        payload: { menuNodeId: id, options: opts },
        nextNodeId: id,
      };
    }

    if (t === "condition") {
      const ev = evaluateConditionSimulation(d, ctx);
      if (ev === null) {
        messages.push({
          from: BOT,
          text: "🔀 Condição: escolha o caminho (simulação).",
        });
        return {
          messages,
          wait: "condition",
          payload: { conditionNodeId: id },
          nextNodeId: id,
        };
      }
      id = pickNextNode(edges, id, ev ? "true" : "false");
      continue;
    }

    if (t === "randomizer") {
      const p = Number(d.percent);
      const useA =
        Number.isFinite(p) && p > 0 && Math.random() * 100 < p;
      id = pickNextNode(edges, id, useA ? "a" : "b");
      messages.push({
        from: BOT,
        text: `🔀 Randomizador → ramo ${useA ? "A" : "B"} (${useA ? p : 100 - p}%).`,
      });
      continue;
    }

    if (t === "img") {
      messages.push({
        from: BOT,
        text: `🖼 Imagem (simulado)${d.url ? `: ${d.url}` : ""}`,
      });
      id = pickNextNode(edges, id, "a");
      continue;
    }

    if (t === "audio") {
      messages.push({
        from: BOT,
        text: `🎵 Áudio (simulado)${d.url ? `: ${d.url}` : ""}`,
      });
      id = pickNextNode(edges, id, "a");
      continue;
    }

    if (t === "video") {
      messages.push({
        from: BOT,
        text: `🎬 Vídeo (simulado)${d.url ? `: ${d.url}` : ""}`,
      });
      id = pickNextNode(edges, id, "a");
      continue;
    }

    if (t === "question") {
      const q =
        d?.typebotIntegration?.message ||
        d?.label ||
        "Pergunta (simulada)";
      messages.push({ from: BOT, text: String(q) });
      return {
        messages,
        wait: "text",
        payload: { afterTextNodeId: id, mode: "question" },
        nextNodeId: id,
      };
    }

    if (t === "waitForInteraction") {
      messages.push({
        from: BOT,
        text: "⌛ Aguardando sua mensagem…",
      });
      return {
        messages,
        wait: "text",
        payload: { afterTextNodeId: id, mode: "wait" },
        nextNodeId: id,
      };
    }

    if (t === "singleBlock") {
      messages.push({
        from: BOT,
        text: "📚 Conteúdo (bloco) — simulação: mensagens do bloco não são expandidas aqui.",
      });
      id = pickNextNode(edges, id, "a");
      continue;
    }

    if (
      t === "ticket" ||
      t === "sector" ||
      t === "tag" ||
      t === "closeTicket" ||
      t === "attendant" ||
      t === "notification" ||
      t === "blacklist" ||
      t === "flowUp"
    ) {
      messages.push({
        from: BOT,
        text: `⚙ Ação “${t}” — apenas simulada (sem alterar dados).`,
      });
      id = pickNextNode(edges, id, "a");
      continue;
    }

    if (t === "httpRequest") {
      messages.push({
        from: BOT,
        text: `🌐 HTTP Request — não executado na simulação${d.url ? ` (${d.url})` : ""}.`,
      });
      id = pickNextNode(edges, id, "a");
      continue;
    }

    if (t === "typebot" || t === "openai") {
      messages.push({
        from: BOT,
        text: `🤖 Integração (${t}) — não executada na simulação.`,
      });
      id = pickNextNode(edges, id, "a");
      continue;
    }

    messages.push({
      from: BOT,
      text: `ℹ Nó “${t}” — passo simulado.`,
    });
    id = pickNextNode(edges, id, "a");
  }

  if (guard >= 300) {
    messages.push({ from: BOT, text: "⚠ Limite de passos — possível ciclo no fluxo." });
  } else {
    messages.push({
      from: BOT,
      text: "— Fim do fluxo (sem próximo passo). —",
    });
  }
  return { messages, wait: null, nextNodeId: null, payload: null };
}

export function firstNodeAfterStart(nodes, edges) {
  const sid = findStartNodeId(nodes);
  if (!sid) return null;
  return pickNextNode(edges, sid, "a");
}
