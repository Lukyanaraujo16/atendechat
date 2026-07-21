import { registerTool, clearToolRegistry } from "./ToolRegistry";
import {
  SystemEchoTool,
  SystemContextSummaryTool,
  SystemHealthCheckTool
} from "./tools/SystemTechnicalTools";
import { READ_TOOLS } from "./tools/ReadOnlyBusinessTools";
import { WRITE_TOOLS } from "./tools/WriteBusinessTools";
import {
  AUTOMATION_TOOL_CAPABILITY_KEYS,
  AUTOMATION_TOOL_DEFAULT_CAPABILITIES
} from "../../../config/automationToolConstants";
import { registerCapability } from "../CapabilityRegistry";

let seeded = false;

export function registerToolCapabilities(): void {
  for (const id of AUTOMATION_TOOL_CAPABILITY_KEYS) {
    registerCapability({
      id: `tools.${id}`,
      name: id,
      description: `Tool capability ${id}`,
      category: "tools",
      future: !id.startsWith("tool."),
      experimental: !AUTOMATION_TOOL_DEFAULT_CAPABILITIES[id],
      deprecated: false
    });
  }
}

export function registerBuiltinTools(): void {
  if (seeded) return;
  registerToolCapabilities();
  registerTool(SystemEchoTool);
  registerTool(SystemContextSummaryTool);
  registerTool(SystemHealthCheckTool);
  for (const tool of READ_TOOLS) {
    registerTool(tool);
  }
  for (const tool of WRITE_TOOLS) {
    registerTool(tool);
  }
  seeded = true;
}

export function resetBuiltinToolsRegistration(): void {
  seeded = false;
  clearToolRegistry();
}

export default registerBuiltinTools;
