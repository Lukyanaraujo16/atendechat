import { ExecutionPlan } from "../types";
import { ExecutionGraph, ExecutionGraphNode } from "./executionTypes";
import { buildDependencyGraph } from "../DependencyResolver";

/**
 * ExecutionGraphBuilder — plano → grafo.
 * Não executa nada.
 */
export function buildExecutionGraph(plan: ExecutionPlan): ExecutionGraph {
  const dep = buildDependencyGraph(plan.steps);
  const groupIndex = new Map<string, number>();
  dep.parallelGroups.forEach((group, i) => {
    for (const id of group) groupIndex.set(id, i);
  });

  const childrenMap = new Map<string, string[]>();
  const parentsMap = new Map<string, string[]>();
  for (const s of plan.steps) {
    childrenMap.set(s.id, []);
    parentsMap.set(s.id, [...(s.dependsOn || [])]);
  }
  for (const s of plan.steps) {
    for (const d of s.dependsOn || []) {
      if (!childrenMap.has(d)) childrenMap.set(d, []);
      childrenMap.get(d)!.push(s.id);
    }
  }

  const nodes: ExecutionGraphNode[] = plan.steps.map(s => ({
    nodeId: `node_${s.id}`,
    stepId: s.id,
    type: s.type,
    objective: s.objective,
    dependencies: [...(s.dependsOn || [])],
    children: childrenMap.get(s.id) || [],
    parents: parentsMap.get(s.id) || [],
    parallelGroup: groupIndex.get(s.id) ?? 0,
    checkpoint: s.requiresConfirmation || s.type === "confirm",
    optional: s.optional,
    retryable: s.retryable,
    requiresConfirmation: s.requiresConfirmation
  }));

  const entryNodeIds = nodes
    .filter(n => n.parents.length === 0)
    .map(n => n.stepId);
  const exitNodeIds = nodes
    .filter(n => n.children.length === 0)
    .map(n => n.stepId);

  return {
    planId: plan.id,
    nodes,
    order: dep.order,
    parallelGroups: dep.parallelGroups,
    edges: dep.edges,
    entryNodeIds,
    exitNodeIds
  };
}

export default { buildExecutionGraph };
