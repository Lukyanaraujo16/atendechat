import AppError from "../../../errors/AppError";
import { ERR_AGENTOS_CONCURRENT_MODIFICATION } from "../../../config/automationAgentOsScalabilityConstants";

/**
 * Optimistic locking helper — conflito estável.
 */
export function assertOptimisticVersion(
  currentVersion: number | null | undefined,
  expectedVersion: number | null | undefined
): void {
  if (expectedVersion == null) return;
  if (Number(currentVersion) !== Number(expectedVersion)) {
    throw new AppError(
      ERR_AGENTOS_CONCURRENT_MODIFICATION,
      409,
      "Recurso modificado concorrentemente"
    );
  }
}

export function nextVersion(current: number | null | undefined): number {
  return (Number(current) || 0) + 1;
}
