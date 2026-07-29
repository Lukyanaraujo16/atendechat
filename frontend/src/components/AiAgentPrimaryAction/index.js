import React from "react";
import { useHistory } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Tooltip from "@material-ui/core/Tooltip";
import {
  AppPrimaryButton,
  AppSecondaryButton,
  AppNeutralButton,
} from "../../ui";
import { i18n } from "../../translate/i18n";

/**
 * Ação principal a partir do nextAction mapeado.
 * Não executa mutações deferred (activate/resume).
 */
export default function AiAgentPrimaryAction({ nextAction, onRefresh }) {
  const history = useHistory();

  if (!nextAction || nextAction.type === "none") {
    return onRefresh ? (
      <AppNeutralButton onClick={onRefresh}>
        {i18n.t("aiAgentProduct.actions.refresh")}
      </AppNeutralButton>
    ) : null;
  }

  if (nextAction.enabled && nextAction.path) {
    return (
      <AppPrimaryButton
        onClick={() => history.push(nextAction.path)}
        data-testid="ai-agent-primary-action"
      >
        {i18n.t(nextAction.labelKey)}
      </AppPrimaryButton>
    );
  }

  // Mutação adiada: oferece revisão segura se houver fallback
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
