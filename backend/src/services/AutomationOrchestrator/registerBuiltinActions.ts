import { registerAction } from "./ActionRegistry";
import ClassifyIntentAction from "./actions/ClassifyIntentAction";
import KnowledgeRetrievalAction from "./actions/KnowledgeRetrievalAction";
import GenerateAIResponseAction from "./actions/GenerateAIResponseAction";
import HumanHandoffAction from "./actions/HumanHandoffAction";
import ChatbotAction from "./actions/ChatbotAction";
import FlowAction from "./actions/FlowAction";
import FinishExecutionAction from "./actions/FinishExecutionAction";
import WaitForMessageAction from "./actions/WaitForMessageAction";
import LogExecutionAction from "./actions/LogExecutionAction";

let registered = false;

export function registerBuiltinActions(): void {
  if (registered) return;
  registerAction(ClassifyIntentAction);
  registerAction(LogExecutionAction);
  registerAction(KnowledgeRetrievalAction);
  registerAction(GenerateAIResponseAction);
  registerAction(HumanHandoffAction);
  registerAction(ChatbotAction);
  registerAction(FlowAction);
  registerAction(FinishExecutionAction);
  registerAction(WaitForMessageAction);
  registered = true;
}

export function resetBuiltinActionsRegistration(): void {
  registered = false;
}

export default registerBuiltinActions;
