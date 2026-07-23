/**
 * Revalidação de boundaries no Runtime (Wave 2).
 * Não altera regras cognitivas — apenas exige asserts de defesa em profundidade.
 */

export type BoundaryKind =
  | "tool"
  | "mcp"
  | "memory"
  | "learning"
  | "delegation"
  | "handoff"
  | "context";

export function assertBoundaryPass(
  kind: BoundaryKind,
  allowed: boolean,
  reason = "boundary_denied"
): void {
  if (!allowed) {
    throw new Error(`ERR_BOUNDARY_${kind.toUpperCase()}:${reason}`);
  }
}

export function revalidateToolBoundary(input: {
  allowed: boolean;
  reason?: string;
}): void {
  assertBoundaryPass("tool", input.allowed, input.reason);
}

export function revalidateMcpBoundary(input: {
  allowed: boolean;
  reason?: string;
}): void {
  assertBoundaryPass("mcp", input.allowed, input.reason);
}

export function revalidateMemoryBoundary(input: {
  allowed: boolean;
  reason?: string;
}): void {
  assertBoundaryPass("memory", input.allowed, input.reason);
}

export function revalidateLearningBoundary(input: {
  allowed: boolean;
  reason?: string;
}): void {
  assertBoundaryPass("learning", input.allowed, input.reason);
}

export function revalidateDelegationBoundary(input: {
  allowed: boolean;
  reason?: string;
}): void {
  assertBoundaryPass("delegation", input.allowed, input.reason);
}

export function revalidateHandoffBoundary(input: {
  allowed: boolean;
  reason?: string;
}): void {
  assertBoundaryPass("handoff", input.allowed, input.reason);
}

export function revalidateContextBoundary(input: {
  allowed: boolean;
  reason?: string;
}): void {
  assertBoundaryPass("context", input.allowed, input.reason);
}
