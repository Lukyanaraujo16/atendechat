/**
 * Classificação visual de tickets em automação (aba Automações / chave interna chatbot).
 */
import { alpha } from "@material-ui/core/styles";

export function isPendingAutomationTicket(ticket) {
  if (!ticket || ticket.isGroup) return false;
  if (ticket.userId != null && ticket.userId !== "") return false;
  if (typeof ticket.automationActive === "boolean") {
    return ticket.automationActive;
  }
  return !!ticket?.chatbot;
}

export function isPendingWaitingTicket(ticket) {
  if (!ticket || ticket.status !== "pending") return true;
  return !isPendingAutomationTicket(ticket);
}

export function resolveAutomationStatusChip(ticket, { theme, i18n }) {
  const isDark = theme.palette.type === "dark";

  if (ticket?.aiAgentHandoffRequested) {
    return {
      label: i18n.t("ticketAiAgent.handoffNeeded"),
      tone: "handoff",
      style: {
        backgroundColor: alpha(theme.palette.error.main, isDark ? 0.22 : 0.12),
        color: isDark ? theme.palette.error.light : theme.palette.error.dark,
      },
    };
  }

  if (ticket?.aiAgentPaused && !ticket?.automationActive) {
    return {
      label: i18n.t("ticketAiAgent.pausedLabel"),
      tone: "paused",
      style: {
        backgroundColor: theme.palette.action.selected,
        color: theme.palette.text.secondary,
      },
    };
  }

  if (ticket?.automationActive || ticket?.chatbot) {
    const label =
      ticket?.automationLabel ||
      (ticket?.chatbot
        ? i18n.t("ticketsListItem.tooltip.chatbot")
        : i18n.t("ticketsListItem.tooltip.aiAgent"));

    const isAi = ticket?.automationType === "ai_agent";
    const isFlow = ticket?.automationType === "flowbuilder";
    const isIntegration =
      ticket?.automationType === "typebot" ||
      ticket?.automationType === "n8n" ||
      ticket?.automationType === "integration";

    let paletteKey = "info";
    if (isAi) paletteKey = "secondary";
    else if (isFlow) paletteKey = "primary";
    else if (isIntegration) paletteKey = "warning";

    const main = theme.palette[paletteKey]?.main || theme.palette.info.main;
    const light =
      theme.palette[paletteKey]?.light || theme.palette.info.light;
    const dark = theme.palette[paletteKey]?.dark || theme.palette.info.dark;

    return {
      label,
      tone: isAi ? "ai" : ticket?.automationType || "chatbot",
      style: {
        backgroundColor: alpha(main, isDark ? 0.22 : 0.12),
        color: isDark ? light : dark,
      },
    };
  }

  return null;
}
