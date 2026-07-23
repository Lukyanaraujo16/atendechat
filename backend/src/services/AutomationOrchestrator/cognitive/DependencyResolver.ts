import { ExecutionStep } from "./types";

export type DependencyGraph = {
  edges: Array<{ from: string; to: string }>;
  order: string[];
  parallelGroups: string[][];
  cycles: string[][];
};

/**
 * Dependency Resolver — ordem topológica + grupos paralelos futuros.
 * Ainda NÃO executa em paralelo.
 */
export function buildDependencyGraph(steps: ExecutionStep[]): DependencyGraph {
  const ids = new Set(steps.map(s => s.id));
  const edges: Array<{ from: string; to: string }> = [];
  const indegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const s of steps) {
    indegree.set(s.id, 0);
    adj.set(s.id, []);
  }

  for (const s of steps) {
    for (const dep of s.dependsOn || []) {
      if (!ids.has(dep)) continue;
      edges.push({ from: dep, to: s.id });
      adj.get(dep)!.push(s.id);
      indegree.set(s.id, (indegree.get(s.id) || 0) + 1);
    }
  }

  // Kahn topological sort + parallel layers
  const indeg = new Map(indegree);
  const parallelGroups: string[][] = [];
  const order: string[] = [];
  let layer = [...steps.map(s => s.id)].filter(id => (indeg.get(id) || 0) === 0);

  while (layer.length) {
    parallelGroups.push([...layer]);
    order.push(...layer);
    const next: string[] = [];
    for (const id of layer) {
      for (const child of adj.get(id) || []) {
        indeg.set(child, (indeg.get(child) || 0) - 1);
        if ((indeg.get(child) || 0) === 0) next.push(child);
      }
    }
    layer = next;
  }

  const cycles: string[][] = [];
  if (order.length < steps.length) {
    const leftover = steps.map(s => s.id).filter(id => !order.includes(id));
    cycles.push(leftover);
  }

  return { edges, order, parallelGroups, cycles };
}

export function getReadySteps(
  steps: ExecutionStep[],
  completedIds: Set<string>
): ExecutionStep[] {
  return steps.filter(s => {
    if (completedIds.has(s.id)) return false;
    if (s.status === "skipped" || s.status === "valid") return false;
    return (s.dependsOn || []).every(d => completedIds.has(d));
  });
}

export default { buildDependencyGraph, getReadySteps };
