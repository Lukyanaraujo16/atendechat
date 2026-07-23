import { RuntimeType } from "../../../config/automationRuntimeIntegrationConstants";
import {
  RuntimeAdapterResult,
  RuntimeCapability,
  RuntimeExecutionRequest
} from "./types";

export type RuntimeAdapterExecuteInput = {
  request: RuntimeExecutionRequest;
  capability: RuntimeCapability;
  companyId: number;
  userId?: number | null;
};

/**
 * RuntimeAdapter — contrato plugável por capacidade/runtime.
 * Implementações concretas conhecem o Runtime; o Core Cognitivo não.
 */
export interface RuntimeAdapter {
  readonly name: string;
  readonly runtimeType: RuntimeType;

  supports(capability: RuntimeCapability): boolean;

  execute(input: RuntimeAdapterExecuteInput): Promise<RuntimeAdapterResult>;
}

export type { RuntimeAdapterResult, RuntimeCapability, RuntimeExecutionRequest };
