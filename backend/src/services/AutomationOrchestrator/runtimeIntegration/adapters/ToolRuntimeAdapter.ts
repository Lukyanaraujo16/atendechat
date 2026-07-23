import { RuntimeType } from "../../../../config/automationRuntimeIntegrationConstants";
import { toolIdToProviderFunctionName } from "../../../../config/automationFunctionCallingConstants";
import { RuntimeAdapter, RuntimeAdapterExecuteInput } from "../RuntimeAdapter";
import { RuntimeAdapterResult, RuntimeCapability } from "../types";
import { getRuntimeIntegrationConfig } from "../RuntimeIntegrationConfig";
import { ensureToolsReady } from "../../tools/ToolAdminServices";

function buildArguments(
  input: RuntimeAdapterExecuteInput
): Record<string, unknown> {
  const params = { ...input.request.parameters };
  if (input.capability.kind === "SEARCH_KNOWLEDGE" && !params.query) {
    params.query = String(input.request.parameters.objective || "produto");
  }
  if (input.capability.kind === "SEARCH_CONTACT" && !params.query) {
    params.query = String(input.request.parameters.objective || "");
  }
  if (input.capability.kind === "SEARCH_TICKET" && !params.query) {
    params.query = String(input.request.parameters.objective || "");
  }
  return params;
}

/**
 * ToolRuntimeAdapter — integra com Selection Engine → FC Resolver → Tool Runtime.
 * Reutiliza runtime existente; não duplica implementação.
 */
export class ToolRuntimeAdapter implements RuntimeAdapter {
  readonly name = "ToolRuntimeAdapter";
  readonly runtimeType: RuntimeType = "TOOL_RUNTIME";

  supports(capability: RuntimeCapability): boolean {
    return capability.runtimeType === "TOOL_RUNTIME";
  }

  async execute(
    input: RuntimeAdapterExecuteInput
  ): Promise<RuntimeAdapterResult> {
    const start = Date.now();
    const config = getRuntimeIntegrationConfig(input.companyId);
    const adapterCfg = config.adapters.TOOL_RUNTIME;

    if (!adapterCfg?.enabled) {
      return {
        status: "denied",
        runtimeType: this.runtimeType,
        adapter: this.name,
        capability: input.capability.kind,
        errors: ["tool_runtime_adapter_disabled"],
        warnings: [],
        durationMs: Date.now() - start,
        metadata: { reusedExistingRuntime: true }
      };
    }

    if (input.capability.metadata?.noRuntimeExecution) {
      return {
        status: "waiting",
        runtimeType: this.runtimeType,
        adapter: this.name,
        capability: input.capability.kind,
        toolId: input.capability.toolId,
        modelResult: {
          awaiting: true,
          kind: input.capability.kind
        },
        errors: [],
        warnings: ["capability_does_not_invoke_tool_runtime"],
        durationMs: Date.now() - start,
        metadata: { reusedExistingRuntime: true, skipped: true }
      };
    }

    await ensureToolsReady();

    const { selectToolsForFunctionCalling } = await import(
      "../../tools/functionCalling/AutomationToolSelectionEngine"
    );
    const { buildProviderToolPayload } = await import(
      "../../tools/functionCalling/AutomationProviderToolAdapter"
    );
    const {
      buildFunctionCallingToolContext,
      resolveProviderToolCall
    } = await import(
      "../../tools/functionCalling/AutomationFunctionCallResolver"
    );
    const { getCompanyToolPolicy } = await import("../../tools/ToolAdminServices");

    const companyPolicy = await getCompanyToolPolicy(input.companyId);
    const toolId = input.capability.toolId || "system.echo";
    const providerName =
      input.capability.providerFunctionName ||
      toolIdToProviderFunctionName(toolId);

    const ctx = buildFunctionCallingToolContext({
      companyId: input.companyId,
      userId: input.userId,
      allowedToolKeys: [],
      source: adapterCfg.origin as "admin_test",
      requestId: input.request.requestId
    });

    const selection = selectToolsForFunctionCalling({
      ctx: { ...ctx, source: "admin_test", adminTestMode: true },
      provider: "openai",
      origin: "admin_test",
      plannerCategories: (input.capability.plannerCategories || []) as any,
      companyPolicy
    });

    const ctxWithAllow = {
      ...ctx,
      allowedToolKeys: selection.allowedToolKeys
    };

    const payload = buildProviderToolPayload({
      manifests: selection.tools,
      provider: "openai"
    });

    const args = buildArguments(input);
    const resolution = await resolveProviderToolCall({
      call: {
        id: `rt-${input.request.requestId}`,
        name: providerName,
        arguments: args
      },
      ctx: ctxWithAllow,
      allowlist: selection.allowlist,
      companyPolicy,
      persist: false
    });

    const status =
      resolution.status === "success"
        ? "success"
        : resolution.status === "denied"
          ? "denied"
          : "failure";

    return {
      status,
      runtimeType: this.runtimeType,
      adapter: this.name,
      capability: input.capability.kind,
      toolId: resolution.toolId,
      modelResult: resolution.modelResult,
      internalData: {
        arguments: args,
        callStatus: resolution.status
      },
      selection: {
        allowedToolKeys: selection.allowedToolKeys,
        rejectedCount: selection.rejected.length,
        toolsCount: selection.tools.length
      },
      resolution: {
        callId: resolution.callId,
        status: resolution.status,
        durationMs: resolution.durationMs,
        error: resolution.error
      },
      errors: resolution.error ? [resolution.error] : [],
      warnings: [],
      durationMs: Date.now() - start,
      metadata: {
        reusedExistingRuntime: true,
        selectionEngine: true,
        functionCallingResolver: true,
        toolRuntime: true,
        operationRuntime: resolution.toolId?.includes("update") ||
          resolution.toolId?.includes("transfer") ||
          resolution.toolId?.includes("note"),
        providerPayloadCount: payload.definitions.neutral.length
      }
    };
  }
}

export default new ToolRuntimeAdapter();
