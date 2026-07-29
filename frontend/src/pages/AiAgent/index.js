import React, { useCallback, useContext, useState } from "react";
import { toast } from "react-toastify";
import { AuthContext } from "../../context/Auth/AuthContext";
import MainContainer from "../../components/MainContainer";
import AiAgentExperiencePage from "../../components/AiAgentExperiencePage";
import useAiAgentProductSummary from "../../hooks/useAiAgentProductSummary";
import { postAiAgentProductCommand } from "../../services/aiAgentProductApi";
import { i18n } from "../../translate/i18n";

function mapCommandError(err) {
  const code = err?.response?.data?.error || err?.response?.data?.message;
  const status = err?.response?.status;
  if (status === 403 || code === "ERR_AI_AGENT_PRODUCT_ACCESS_DENIED") {
    return i18n.t("aiAgentProduct.commandErrors.accessDenied");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE") {
    return i18n.t("aiAgentProduct.commandErrors.notAvailable");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_NOT_READY") {
    return i18n.t("aiAgentProduct.commandErrors.notReady");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_CONNECTION_UNAVAILABLE") {
    return i18n.t("aiAgentProduct.commandErrors.connectionUnavailable");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_COMMAND_NOT_ALLOWED") {
    return i18n.t("aiAgentProduct.commandErrors.notAllowed");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS") {
    return i18n.t("aiAgentProduct.commandErrors.ambiguous");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID") {
    return i18n.t("aiAgentProduct.commandErrors.contextInvalid");
  }
  return i18n.t("aiAgentProduct.commandErrors.generic");
}

/**
 * Hub comercial /ai-agent — Experience Layer (Fases 2.1–2.2).
 * Leitura e mutações comerciais via Product API apenas.
 */
const AiAgent = () => {
  const { user } = useContext(AuthContext);
  const { loading, error, accessDenied, data, reload, applySummary } =
    useAiAgentProductSummary({ enabled: true });
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandError, setCommandError] = useState(null);

  const handleCommand = useCallback(
    async (command) => {
      if (commandBusy) return;
      setCommandBusy(true);
      setCommandError(null);
      try {
        const { data: result } = await postAiAgentProductCommand(command);
        if (result?.summary) {
          applySummary(result.summary);
        } else {
          await reload();
        }
        const successKey = `aiAgentProduct.commandSuccess.${command}`;
        toast.success(i18n.t(successKey));

      } catch (err) {
        const message = mapCommandError(err);
        setCommandError(message);
        toast.error(message);
        throw err;
      } finally {
        setCommandBusy(false);
      }
    },
    [applySummary, commandBusy, reload]
  );

  const companyLabel =
    user?.company?.name ||
    user?.companyName ||
    (user?.companyId != null ? String(user.companyId) : "");

  return (
    <MainContainer>
      <AiAgentExperiencePage
        loading={loading}
        error={error}
        accessDenied={accessDenied}
        summary={data}
        onRetry={reload}
        onCommand={handleCommand}
        commandBusy={commandBusy}
        commandError={commandError}
        supportMode={user?.supportMode === true}
        companyLabel={companyLabel}
      />
    </MainContainer>
  );
};

export default AiAgent;
