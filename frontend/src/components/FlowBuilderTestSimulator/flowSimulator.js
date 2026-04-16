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

const CONTEXT_FIELDS = new Set([
  "body",
  "isFirstInteraction",
  "hasQueue",
  "hasUser",
]);
const CONTACT_FIELDS = new Set(["name", "number", "email"]);

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
    if (field === "email") return String(ctx.mockEmail || "");
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
 * Detalhe da avaliação de condição (preview).
 * @returns {{ value: boolean | null, manualReason: 'variableOrTicket' | 'unknownField' | null }}
 */
export function evaluateConditionDetailed(nodeData, ctx) {
  const mode = nodeData?.mode === "any" ? "any" : "all";
  const rules = Array.isArray(nodeData?.rules) ? nodeData.rules : [];
  if (!rules.length) return { value: false, manualReason: null };

  let manualReason = null;
  const results = rules.map((rule) => {
    if (!rule || !rule.operator) return false;
    if (rule.source === "variable" || rule.source === "ticket") {
      manualReason = "variableOrTicket";
      return false;
    }
    if (
      rule.source === "context" &&
      !CONTEXT_FIELDS.has(String(rule.field || ""))
    ) {
      manualReason = "unknownField";
      return false;
    }
    if (
      rule.source === "contact" &&
      !CONTACT_FIELDS.has(String(rule.field || ""))
    ) {
      manualReason = "unknownField";
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
    return evalOperator(
      left,
      rule.operator,
      needs ? rule.value : undefined
    );
  });

  if (manualReason) return { value: null, manualReason };
  const value = mode === "any" ? results.some(Boolean) : results.every(Boolean);
  return { value, manualReason: null };
}

/**
 * Avalia condição no simulador. Retorna true/false ou null se precisar escolha manual.
 */
export function evaluateConditionSimulation(nodeData, ctx) {
  const { value } = evaluateConditionDetailed(nodeData, ctx);
  return value;
}

const BOT = "bot";

/** Expande sequência do singleBlock (seq + elements) em mensagens de preview. */
export function expandSingleBlockPreviewMessages(data) {
  const seq = Array.isArray(data?.seq) ? data.seq : [];
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  const out = [];
  for (const ref of seq) {
    const el = elements.find((e) => e && e.number === ref);
    if (!el) continue;
    if (String(ref).includes("message")) {
      const text = String(el.value || "").trim() || "(vazio)";
      out.push({ from: BOT, text });
    } else if (String(ref).includes("interval")) {
      const sec = Number(el.value) || 0;
      out.push({
        from: BOT,
        text:
          sec > 0
            ? `⏱ Pausa de ${sec}s (simulada — sem espera real).`
            : "⏱ Intervalo (simulado).",
      });
    } else if (String(ref).includes("img")) {
      const hint = el.original || el.value || "";
      out.push({
        from: BOT,
        text: `🖼 Imagem (simulado)${hint ? `: ${hint}` : ""}`,
      });
    } else if (String(ref).includes("audio")) {
      const hint = el.original || el.value || "";
      out.push({
        from: BOT,
        text: `🎵 Áudio (simulado)${hint ? `: ${hint}` : ""}`,
      });
    } else if (String(ref).includes("video")) {
      const hint = el.original || el.value || "";
      out.push({
        from: BOT,
        text: `🎬 Vídeo (simulado)${hint ? `: ${hint}` : ""}`,
      });
    }
  }
  if (!out.length) {
    out.push({
      from: "system",
      kind: "hint",
      hintKey: "singleBlockEmpty",
    });
  }
  return out;
}

function stepInfoFromNode(node) {
  if (!node) return null;
  const d = node.data || {};
  const t = node.type;
  let label = t || "";
  if (t === "message") label = String(d.label || "").trim().slice(0, 40) || "message";
  else if (t === "menu") label = "menu";
  else if (t === "condition") label = "condition";
  else if (t === "singleBlock") label = "singleBlock";
  else if (t === "question") label = "question";
  else if (t === "waitForInteraction") label = "waitForInteraction";
  return { nodeId: node.id, nodeType: t, label };
}

function simulatedActionRow(action, detail) {
  return {
    from: "system",
    kind: "simulated_action",
    action,
    detail: detail != null ? String(detail) : "",
  };
}

/**
 * Executa passos automáticos até precisar de input ou fim.
 * @returns {{ messages: object[], wait, payload, nextNodeId, stepInfo }}
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
      return {
        messages,
        wait: null,
        nextNodeId: null,
        payload: null,
        stepInfo: null,
      };
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
        stepInfo: stepInfoFromNode(node),
      };
    }

    if (t === "condition") {
      const { value: ev, manualReason } = evaluateConditionDetailed(d, ctx);
      if (ev === null) {
        messages.push({
          from: "system",
          kind: "condition_hint",
          manualReason: manualReason || "variableOrTicket",
        });
        messages.push({
          from: BOT,
          text: "🔀 Escolha o caminho (sim / não) para continuar o preview.",
        });
        return {
          messages,
          wait: "condition",
          payload: { conditionNodeId: id, manualReason: manualReason || "variableOrTicket" },
          nextNodeId: id,
          stepInfo: stepInfoFromNode(node),
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
        stepInfo: stepInfoFromNode(node),
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
        stepInfo: stepInfoFromNode(node),
      };
    }

    if (t === "singleBlock") {
      const expanded = expandSingleBlockPreviewMessages(d);
      expanded.forEach((row) => messages.push(row));
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
      messages.push(simulatedActionRow("admin", t));
      id = pickNextNode(edges, id, "a");
      continue;
    }

    if (t === "httpRequest") {
      messages.push(simulatedActionRow("http", d.url || ""));
      id = pickNextNode(edges, id, "a");
      continue;
    }

    if (t === "typebot") {
      messages.push(simulatedActionRow("typebot", d.slug || d.name || ""));
      id = pickNextNode(edges, id, "a");
      continue;
    }

    if (t === "openai") {
      messages.push(simulatedActionRow("openai", ""));
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
  return {
    messages,
    wait: null,
    nextNodeId: null,
    payload: null,
    stepInfo: null,
  };
}

export function firstNodeAfterStart(nodes, edges) {
  const sid = findStartNodeId(nodes);
  if (!sid) return null;
  return pickNextNode(edges, sid, "a");
}
