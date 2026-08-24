import React, { useEffect } from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import { AppSecondaryButton } from "../../ui";
import ConfirmationModal from "../ConfirmationModal";
import useAiAgentReconfigure from "../../hooks/useAiAgentReconfigure";
import { i18n } from "../../translate/i18n";

/**
 * CTA “Reconfigurar agente” na Visão geral (Fase 2.21B).
 * Agente desativado: abre o wizard. Agente ativo: confirma e desativa primeiro.
 */
export default function AiAgentReconfigureControl({
  agentRef,
  summary,
  canMutate = false,
  commandBusy = null,
  onRetry,
  onBusyChange,
}) {
  const api = useAiAgentReconfigure({
    agentRef,
    summary,
    canMutate,
    commandBusy,
    onRetry,
  });

  useEffect(() => {
    if (typeof onBusyChange !== "function") return undefined;
    onBusyChange(api.busy);
    return () => onBusyChange(false);
  }, [api.busy, onBusyChange]);

  if (!api.visible) return null;

  const name =
    String(summary?.agent?.name || "").trim() ||
    i18n.t("aiAgentProduct.meta.unnamed");

  return (
    <Box>
      <AppSecondaryButton
        onClick={api.start}
        disabled={api.blocked}
        data-testid="ai-agent-reconfigure-cta"
        aria-label={i18n.t("aiAgentProduct.reconfigure.ctaAria", { name })}
      >
        {i18n.t("aiAgentProduct.reconfigure.cta")}
      </AppSecondaryButton>
      <ConfirmationModal
        title={i18n.t("aiAgentProduct.reconfigure.confirmTitle", { name })}
        open={api.confirmOpen}
        onClose={api.cancel}
        onConfirm={api.confirm}
        confirmText={i18n.t("aiAgentProduct.reconfigure.confirmAction")}
        cancelText={i18n.t("confirmationModal.buttons.cancel")}
        loading={api.busy}
        asyncConfirm
      >
        <Typography
          variant="body2"
          paragraph
          data-testid="ai-agent-reconfigure-body-deactivate"
        >
          {i18n.t("aiAgentProduct.reconfigure.confirmBodyDeactivate")}
        </Typography>
        <Typography variant="body2" paragraph>
          {i18n.t("aiAgentProduct.reconfigure.confirmBodyNavigate")}
        </Typography>
        <Typography variant="body2">
          {i18n.t("aiAgentProduct.reconfigure.confirmBodySave")}
        </Typography>
      </ConfirmationModal>
    </Box>
  );
}
