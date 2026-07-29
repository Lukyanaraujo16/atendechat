import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Tooltip from "@material-ui/core/Tooltip";
import {
  AppPrimaryButton,
  AppSecondaryButton,
  AppNeutralButton,
} from "../../ui";
import ConfirmationModal from "../ConfirmationModal";
import { getAiAgentCommandConfirmKeys, getAiAgentCommandConfirmParams } from "../../utils/aiAgentProductMapper";
import { i18n } from "../../translate/i18n";

/**
 * Ação principal a partir do nextAction mapeado.
 * Comandos activate_* usam Product API via onCommand.
 * resume_agent permanece desabilitado.
 */
export default function AiAgentPrimaryAction({
  nextAction,
  onRefresh,
  onCommand,
  commandBusy = false,
  connectionScope = null,
}) {
  const history = useHistory();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!nextAction || nextAction.type === "none") {
    return onRefresh ? (
      <AppNeutralButton onClick={onRefresh} disabled={commandBusy}>
        {i18n.t("aiAgentProduct.actions.refresh")}
      </AppNeutralButton>
    ) : null;
  }

  if (nextAction.enabled && nextAction.command) {
    if (typeof onCommand === "function") {
      const keys = getAiAgentCommandConfirmKeys(nextAction.command);
      const params = getAiAgentCommandConfirmParams(connectionScope);
      return (
        <>
          <AppPrimaryButton
            onClick={() => setConfirmOpen(true)}
            disabled={commandBusy}
            data-testid="ai-agent-primary-action"
          >
            {i18n.t(nextAction.labelKey)}
          </AppPrimaryButton>
          <ConfirmationModal
            title={i18n.t(keys.titleKey)}
            open={confirmOpen}
            onClose={() => !commandBusy && setConfirmOpen(false)}
            onConfirm={async () => {
              try {
                await onCommand(nextAction.command);
                setConfirmOpen(false);
              } catch (_err) {
                // mantém modal aberto para retry; erro tratado pelo pai
              }
            }}
            confirmText={i18n.t(keys.confirmKey)}
            destructive={keys.destructive}
            loading={commandBusy}
            asyncConfirm
          >
            {i18n.t(keys.bodyKey, params)}
          </ConfirmationModal>
        </>
      );
    }

    return (
      <Tooltip title={i18n.t("aiAgentProduct.nextAction.mutationDeferred")}>
        <span>
          <AppPrimaryButton disabled data-testid="ai-agent-primary-action-disabled">
            {i18n.t(nextAction.labelKey)}
          </AppPrimaryButton>
        </span>
      </Tooltip>
    );
  }

  if (nextAction.enabled && nextAction.path) {
    return (
      <AppPrimaryButton
        onClick={() => history.push(nextAction.path)}
        disabled={commandBusy}
        data-testid="ai-agent-primary-action"
      >
        {i18n.t(nextAction.labelKey)}
      </AppPrimaryButton>
    );
  }

  if (nextAction.fallbackPath) {
    return (
      <Box display="flex" flexWrap="wrap" gridGap={8} style={{ gap: 8 }}>
        <Tooltip title={i18n.t(nextAction.reasonKey || nextAction.labelKey)}>
          <span>
            <AppPrimaryButton disabled data-testid="ai-agent-primary-action-disabled">
              {i18n.t(nextAction.labelKey)}
            </AppPrimaryButton>
          </span>
        </Tooltip>
        <AppSecondaryButton
          onClick={() => history.push(nextAction.fallbackPath)}
          disabled={commandBusy}
          data-testid="ai-agent-primary-fallback"
        >
          {i18n.t(
            nextAction.fallbackLabelKey || "aiAgentProduct.nextAction.reviewConfig"
          )}
        </AppSecondaryButton>
      </Box>
    );
  }

  return (
    <Tooltip title={i18n.t(nextAction.reasonKey || "aiAgentProduct.nextAction.none")}>
      <span>
        <AppPrimaryButton disabled>
          {i18n.t(nextAction.labelKey)}
        </AppPrimaryButton>
      </span>
    </Tooltip>
  );
}
