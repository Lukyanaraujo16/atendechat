import AppError from "../errors/AppError";

/**
 * Ownership HTTP pós-service (Fase 1.4.1).
 * Não altera AutomationOrchestrator — filtra/nega na borda.
 */

export function assertRecordOwnedByCompany(
  record: { companyId?: number | null } | null | undefined,
  companyId: number
): void {
  if (
    record == null ||
    record.companyId == null ||
    Number(record.companyId) !== Number(companyId)
  ) {
    throw new AppError("ERR_NOT_FOUND", 404);
  }
}

export function filterRecordsOwnedByCompany<
  T extends { companyId?: number | null }
>(records: T[] | null | undefined, companyId: number): T[] {
  if (!Array.isArray(records)) return [];
  return records.filter(
    r => r != null && Number(r.companyId) === Number(companyId)
  );
}

/** Índice local de actionIds por tenant (store Orchestrator é global sem companyId). */
const actionIdsByCompany = new Map<number, Set<string>>();

export function rememberCompanyActionId(
  companyId: number,
  actionId: string | null | undefined
): void {
  if (!actionId) return;
  const cid = Number(companyId);
  if (!Number.isFinite(cid) || cid < 1) return;
  let set = actionIdsByCompany.get(cid);
  if (!set) {
    set = new Set();
    actionIdsByCompany.set(cid, set);
  }
  set.add(String(actionId));
  if (set.size > 2000) {
    const first = set.values().next().value;
    if (first != null) set.delete(first);
  }
}

export function companyOwnsActionId(
  companyId: number,
  actionId: string
): boolean {
  return actionIdsByCompany.get(Number(companyId))?.has(String(actionId)) === true;
}

export function filterActionResultsForCompany<
  T extends { actionId?: string }
>(results: T[] | null | undefined, companyId: number): T[] {
  if (!Array.isArray(results)) return [];
  return results.filter(
    r => r?.actionId != null && companyOwnsActionId(companyId, r.actionId)
  );
}

export function assertCompanyOwnsActionId(
  companyId: number,
  actionId: string
): void {
  if (!companyOwnsActionId(companyId, actionId)) {
    throw new AppError("ERR_NOT_FOUND", 404);
  }
}

/** Testes */
export function __resetAgentOsActionOwnershipIndexForTests(): void {
  actionIdsByCompany.clear();
}
