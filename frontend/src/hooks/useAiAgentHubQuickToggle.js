/**
 * Lógica do toggle rápido no Hub (Fase 2.19).
 * Isolada do Switch MUI para testes e concorrência agent-scoped.
 */
import { useCallback, useRef, useState } from "react";
import { toast } from "react-toastify";
import { postAiAgentProductCommand } from "../services/aiAgentProductApi";
import { notifyAiAgentProductAgentsChanged } from "../utils/aiAgentProductAgentsCache";
import {
  mapAiAgentProductCommandError,
  rememberAiAgentLastOperationMode,
  resolveAiAgentQuickActivateCommand,
} from "../utils/aiAgentQuickToggle";
import { i18n } from "../translate/i18n";

export default function useAiAgentHubQuickToggle({
  canMutate = false,
  onRetry,
  onReview,
} = {}) {
  const requestSeqByRef = useRef({});
  const busyRef = useRef(null);
  const [busyAgentRef, setBusyAgentRef] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [notReadyTarget, setNotReadyTarget] = useState(null);

  const runCommand = useCallback(
    async (agent, command) => {
      const agentRef = String(agent?.agentRef || "").trim();
      if (!agentRef || !canMutate) return;
      if (busyRef.current === agentRef) return;

      const seq = (requestSeqByRef.current[agentRef] || 0) + 1;
      requestSeqByRef.current[agentRef] = seq;
      busyRef.current = agentRef;
      setBusyAgentRef(agentRef);

      try {
        await postAiAgentProductCommand(command, agentRef);
        if (requestSeqByRef.current[agentRef] !== seq) return;
        notifyAiAgentProductAgentsChanged();
        toast.success(
          i18n.t(
            command === "deactivate"
              ? "aiAgentProduct.hub.quickToggle.deactivated"
              : "aiAgentProduct.hub.quickToggle.activated"
          )
        );
        if (typeof onRetry === "function") {
          await onRetry();
        }
      } catch (err) {
        if (requestSeqByRef.current[agentRef] !== seq) return;
        toast.error(mapAiAgentProductCommandError(err));
        throw err;
      } finally {
        if (requestSeqByRef.current[agentRef] === seq) {
          busyRef.current = null;
          setBusyAgentRef(null);
        }
      }
    },
    [canMutate, onRetry]
  );

  const handleToggleRequest = useCallback(
    (agent, nextEnabled) => {
      const agentRef = String(agent?.agentRef || "").trim();
      if (!agentRef || !canMutate || busyRef.current === agentRef) return;

      if (nextEnabled) {
        if (agent?.ready !== true) {
          setNotReadyTarget(agent);
          return;
        }
        const command = resolveAiAgentQuickActivateCommand(agent);
        runCommand(agent, command).catch(() => {});
        return;
      }

      setDeactivateTarget(agent);
    },
    [canMutate, runCommand]
  );

  const confirmDeactivate = useCallback(async () => {
    const agent = deactivateTarget;
    if (!agent) return;
    const agentRef = String(agent.agentRef || "").trim();
    rememberAiAgentLastOperationMode(agentRef, agent.operationMode);
    try {
      await runCommand(agent, "deactivate");
      setDeactivateTarget(null);
    } catch (_err) {
      // toast já exibido; mantém modal para retry
    }
  }, [deactivateTarget, runCommand]);

  const cancelDeactivate = useCallback(() => {
    if (busyRef.current) return;
    setDeactivateTarget(null);
  }, []);

  const dismissNotReady = useCallback(() => {
    setNotReadyTarget(null);
  }, []);

  const confirmNotReadyReview = useCallback(() => {
    const agent = notReadyTarget;
    setNotReadyTarget(null);
    if (agent && typeof onReview === "function") {
      onReview(agent);
    }
  }, [notReadyTarget, onReview]);

  return {
    busyAgentRef,
    deactivateTarget,
    notReadyTarget,
    handleToggleRequest,
    confirmDeactivate,
    cancelDeactivate,
    dismissNotReady,
    confirmNotReadyReview,
  };
}
