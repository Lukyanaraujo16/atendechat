import { ActionType } from "../../../../config/automationActionExecutionConstants";
import { ExecutionStrategy } from "./ExecutionStrategy";
import { ExecutionAction } from "./actionTypes";
import searchStrategy from "./strategies/SearchStrategy";
import validateStrategy from "./strategies/ValidateStrategy";
import transferStrategy from "./strategies/TransferStrategy";
import updateStrategy from "./strategies/UpdateStrategy";
import messagingStrategy from "./strategies/MessagingStrategy";
import confirmationStrategy from "./strategies/ConfirmationStrategy";
import inputStrategy from "./strategies/InputStrategy";
import customStrategy from "./strategies/CustomStrategy";

const DEFAULT_STRATEGIES: ExecutionStrategy[] = [
  searchStrategy,
  validateStrategy,
  transferStrategy,
  updateStrategy,
  messagingStrategy,
  confirmationStrategy,
  inputStrategy,
  customStrategy
];

export class ExecutionStrategyRegistry {
  private readonly byType = new Map<ActionType, ExecutionStrategy>();
  private readonly strategies: ExecutionStrategy[];

  constructor(strategies: ExecutionStrategy[] = DEFAULT_STRATEGIES) {
    this.strategies = [...strategies];
    for (const strategy of this.strategies) {
      for (const actionType of strategy.actionTypes) {
        if (!this.byType.has(actionType)) {
          this.byType.set(actionType, strategy);
        }
      }
    }
  }

  resolve(action: ExecutionAction): ExecutionStrategy | null {
    const direct = this.byType.get(action.actionType);
    if (direct?.supports(action)) return direct;
    return (
      this.strategies.find(s => s.supports(action)) || null
    );
  }

  list(): Array<{
    name: string;
    actionTypes: readonly ActionType[];
  }> {
    return this.strategies.map(s => ({
      name: s.name,
      actionTypes: [...s.actionTypes]
    }));
  }

  register(strategy: ExecutionStrategy): void {
    this.strategies.push(strategy);
    for (const actionType of strategy.actionTypes) {
      this.byType.set(actionType, strategy);
    }
  }
}

export const defaultStrategyRegistry = new ExecutionStrategyRegistry();

export default defaultStrategyRegistry;
