import { RuntimeAdapter } from "./RuntimeAdapter";
import { RuntimeCapability } from "./types";
import toolRuntimeAdapter from "./adapters/ToolRuntimeAdapter";
import mcpRuntimeAdapter from "../mcp/adapters/McpRuntimeAdapter";

const ADAPTERS: RuntimeAdapter[] = [toolRuntimeAdapter, mcpRuntimeAdapter];

/**
 * Resolve adaptador concreto a partir da RuntimeCapability.
 * Dispatcher decide "o quê"; registry decide "quem".
 */
export class RuntimeAdapterRegistry {
  private readonly adapters: RuntimeAdapter[];

  constructor(adapters: RuntimeAdapter[] = ADAPTERS) {
    this.adapters = [...adapters];
  }

  resolve(capability: RuntimeCapability): RuntimeAdapter | null {
    const preferred = this.adapters.find(
      a => a.name === capability.requiredAdapter && a.supports(capability)
    );
    if (preferred) return preferred;
    return (
      this.adapters.find(a => a.supports(capability)) || null
    );
  }

  list(): Array<{ name: string; runtimeType: string }> {
    return this.adapters.map(a => ({
      name: a.name,
      runtimeType: a.runtimeType
    }));
  }

  register(adapter: RuntimeAdapter): void {
    this.adapters.push(adapter);
  }
}

export const defaultRuntimeAdapterRegistry = new RuntimeAdapterRegistry();

export default defaultRuntimeAdapterRegistry;
