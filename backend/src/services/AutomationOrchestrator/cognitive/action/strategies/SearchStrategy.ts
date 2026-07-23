import { ActionType } from "../../../../../config/automationActionExecutionConstants";
import { BaseSimulatedStrategy } from "./BaseSimulatedStrategy";
import { ExecutionAction } from "../actionTypes";

export class SearchStrategy extends BaseSimulatedStrategy {
  readonly name = "SearchStrategy";
  readonly actionTypes: readonly ActionType[] = ["SEARCH"];

  protected simulateOutput(action: ExecutionAction): Record<string, unknown> {
    return {
      kind: "search",
      query: action.objective,
      hits: [{ id: "sim_1", summary: "Resultado simulado (sem Tool Runtime)" }],
      usesToolRuntime: false
    };
  }
}

export default new SearchStrategy();
