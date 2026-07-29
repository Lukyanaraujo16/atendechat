import {
  AiAgentProductAffectedConnections,
  AiAgentProductConnectionScope
} from "../../types/aiAgentProduct";
import { AiAgentRuntimeMode } from "../AiAgentService/aiAgentRuntimeMode";
import { technicalModeToCommercial } from "./AgentReadinessService";

export type ConnectionScopeInput = {
  id: number;
  name: string;
  status: string;
  runtimeMode?: AiAgentRuntimeMode;
};

/** Ordenação estável para locks, summary e escopo. */
export function sortConnectionsByIdAsc<T extends { id: number }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => Number(a.id) - Number(b.id));
}

export function isWhatsappConnected(status: string | null | undefined): boolean {
  return String(status || "").toUpperCase() === "CONNECTED";
}

/**
 * Escopo comercial Opção A — todas as conexões vinculadas ao agente.
 * Sem ids técnicos; nomes comerciais apenas.
 */
export function buildAiAgentProductConnectionScope(
  linked: ConnectionScopeInput[]
): AiAgentProductConnectionScope {
  const ordered = sortConnectionsByIdAsc(linked);
  let connectedCount = 0;
  const names: string[] = [];
  for (const c of ordered) {
    if (isWhatsappConnected(c.status)) connectedCount += 1;
    const name = String(c.name || "").trim();
    names.push(name || "—");
  }
  return {
    type: "all_linked",
    count: ordered.length,
    connectedCount,
    disconnectedCount: ordered.length - connectedCount,
    names
  };
}

export function emptyConnectionScope(): AiAgentProductConnectionScope {
  return {
    type: "all_linked",
    count: 0,
    connectedCount: 0,
    disconnectedCount: 0,
    names: []
  };
}

/**
 * Modo agregado explícito incluindo mixed (para impacto do comando).
 */
export function resolveAffectedFromMode(
  linked: Array<{ runtimeMode: AiAgentRuntimeMode }>
): "off" | "shadow" | "live" | "mixed" {
  let hasLive = false;
  let hasShadow = false;
  let hasOff = false;
  for (const c of linked) {
    const m = technicalModeToCommercial(c.runtimeMode);
    if (m === "live") hasLive = true;
    else if (m === "shadow") hasShadow = true;
    else hasOff = true;
  }
  const activeKinds = (hasLive ? 1 : 0) + (hasShadow ? 1 : 0);
  if (activeKinds > 1) return "mixed";
  if (hasLive && hasOff) return "mixed";
  if (hasShadow && hasOff) return "mixed";
  if (hasLive) return "live";
  if (hasShadow) return "shadow";
  return "off";
}

export function buildAffectedConnections(input: {
  linked: ConnectionScopeInput[];
  fromMode: "off" | "shadow" | "live" | "mixed";
  toMode: "off" | "shadow" | "live";
}): AiAgentProductAffectedConnections {
  const scope = buildAiAgentProductConnectionScope(input.linked);
  return {
    scope: "all_linked",
    count: scope.count,
    names: scope.names,
    fromMode: input.fromMode,
    toMode: input.toMode
  };
}

/**
 * True quando há modos comerciais ativos distintos entre conexões
 * (ex.: A live + B shadow) ou ativo misturado com off sob agente enabled.
 */
export function hasMixedConnectionModes(
  linked: Array<{ runtimeMode: AiAgentRuntimeMode }>
): boolean {
  const modes = new Set(
    linked.map(c => technicalModeToCommercial(c.runtimeMode))
  );
  const active = [...modes].filter(m => m !== "off");
  return active.length > 1;
}
