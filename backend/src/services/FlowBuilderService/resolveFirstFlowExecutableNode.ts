import type {
  IConnections,
  INodes
} from "../WebhookService/DispatchWebHookService";

export function resolveFirstFlowExecutableNodeId(
  nodes: INodes[],
  connections: IConnections[]
): {
  startNodeId: string | null;
  firstEdgeTarget: string | null;
  firstExecutableNodeId: string | null;
  firstExecutableNodeType: string | null;
} {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeConnections = Array.isArray(connections) ? connections : [];
  const first = safeNodes[0];
  if (!first) {
    return {
      startNodeId: null,
      firstEdgeTarget: null,
      firstExecutableNodeId: null,
      firstExecutableNodeType: null
    };
  }

  if (first.type !== "start") {
    return {
      startNodeId: first.id,
      firstEdgeTarget: null,
      firstExecutableNodeId: first.id,
      firstExecutableNodeType: first.type
    };
  }

  const startNodeId = first.id;
  const outgoing = safeConnections.filter(c => c && c.source === startNodeId);
  const firstEdge = outgoing[0];
  const firstEdgeTarget = firstEdge?.target ?? null;

  if (!firstEdgeTarget) {
    return {
      startNodeId,
      firstEdgeTarget: null,
      firstExecutableNodeId: null,
      firstExecutableNodeType: null
    };
  }

  const targetNode = safeNodes.find(n => n.id === firstEdgeTarget);
  return {
    startNodeId,
    firstEdgeTarget,
    firstExecutableNodeId: targetNode?.id ?? firstEdgeTarget,
    firstExecutableNodeType: targetNode?.type ?? null
  };
}
