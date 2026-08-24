/**
 * Reconfiguração estrutural pelo wizard existente (Fase 2.21B).
 * Não cria agente novo. Desativação reutiliza o command Product `deactivate`.
 * Modo operacional (live/shadow) é autoridade do backend (Fase 2.19.1).
 */
import { useCallback, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import { postAiAgentProductCommand } from "../services/aiAgentProductApi";
import { aiAgentWizardEditPath } from "../config/aiAgentFeature";
import { notifyAiAgentProductAgentsChanged } from "../utils/aiAgentProductAgentsCache";
import { mapAiAgentProductCommandError } from "../utils/aiAgentQuickToggle";
import { i18n } from "../translate/i18n";

export function isAiAgentStructurallyLocked(summary) {
  return summary?.agent?.enabled === true;
}

export function canShowAiAgentReconfigure({
  canMutate,
  agentRef,
  summary,
} = {}) {
  if (canMutate !== true) return false;
  const ref = String(agentRef || "").trim();
  if (!ref) return false;
  if (!summary || typeof summary !== "object") return false;
  if (summary.status === "unavailable" || summary.status === "not_created") {
    return false;
  }
  if (summary.agent?.exists !== true) return false;
  return true;
}

export default function useAiAgentReconfigure({
  agentRef,
  summary,
  canMutate = false,
  commandBusy = null,
  onRetry,
} = {}) {
  const history = useHistory();
  const inFlightRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const refKey = String(agentRef || "").trim();
  const visible = canShowAiAgentReconfigure({
    canMutate,
    agentRef: refKey,
    summary,
  });
  const locked = isAiAgentStructurallyLocked(summary);
  const parentBusy = Boolean(commandBusy);
  const blocked = !visible || parentBusy || busy;

  const goToWizard = useCallback(
    (targetRef) => {
      const path = aiAgentWizardEditPath(targetRef);
      if (!path) return;
      history.push(path);
    },
    [history]
  );

  const start = useCallback(() => {
    if (!visible || inFlightRef.current || parentBusy) return;
    if (!refKey) return;
    if (locked) {
      setConfirmOpen(true);
      return;
    }
    goToWizard(refKey);
  }, [visible, parentBusy, refKey, locked, goToWizard]);

  const cancel = useCallback(() => {
    if (inFlightRef.current || busy) return;
    setConfirmOpen(false);
  }, [busy]);

  const confirm = useCallback(async () => {
    if (!visible || !refKey || inFlightRef.current) return false;
    inFlightRef.current = true;
    setBusy(true);
    try {
      await postAiAgentProductCommand("deactivate", refKey);
      notifyAiAgentProductAgentsChanged();
      toast.success(i18n.t("aiAgentProduct.commandSuccess.deactivate"));
      if (typeof onRetry === "function") {
        await onRetry();
      }
      setConfirmOpen(false);
      goToWizard(refKey);
      return true;
    } catch (err) {
      toast.error(mapAiAgentProductCommandError(err));
      return false;
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }, [visible, refKey, onRetry, goToWizard]);

  return {
    visible,
    locked,
    blocked,
    busy,
    confirmOpen,
    agentRef: refKey,
    start,
    cancel,
    confirm,
    goToWizard,
  };
}
