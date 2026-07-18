import {
  AutomationCapabilityKey
} from "../../config/automationOrchestratorConstants";
import { ActionResult, ExecutionContext } from "./types";

export interface AutomationAction {
  name: string;
  /** Se true, a action mutaria estado externo (WhatsApp, ticket, etc.). */
  sideEffects?: boolean;
  supportsShadow?: boolean;
  supportsObserve?: boolean;
  supportsActive?: boolean;
  capability?: AutomationCapabilityKey;
  supports(ctx: ExecutionContext): boolean;
  validate(
    ctx: ExecutionContext,
    params?: Record<string, unknown>
  ): void | Promise<void>;
  execute(
    ctx: ExecutionContext,
    params?: Record<string, unknown>
  ): Promise<ActionResult>;
  rollback?(
    ctx: ExecutionContext,
    params?: Record<string, unknown>
  ): Promise<void>;
}

const registry = new Map<string, AutomationAction>();

export function registerAction(action: AutomationAction): void {
  registry.set(action.name, action);
}

export function getAction(name: string): AutomationAction | undefined {
  return registry.get(name);
}

export function listActions(): string[] {
  return Array.from(registry.keys());
}

export function clearActionRegistry(): void {
  registry.clear();
}

export default {
  registerAction,
  getAction,
  listActions,
  clearActionRegistry
};
