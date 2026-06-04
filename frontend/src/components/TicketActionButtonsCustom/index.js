import React, { useContext, useState } from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { Replay } from "@material-ui/icons";
import Tooltip from "@material-ui/core/Tooltip";
import IconButton from "@material-ui/core/IconButton";
import Button from "@material-ui/core/Button";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import TicketActionModals from "../TicketActionModals";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsSetContext } from "../../context/Tickets/TicketsContext";
import { TicketsInboxContext } from "../../context/TicketsInboxContext";
import TicketConversationActionBar from "../TicketConversationActionBar";
import usePlanFlags from "../../hooks/usePlanFlags";
import TicketCrmDealButton from "../Crm/TicketCrmDealButton";
import { TicketTagsButton } from "../TagsContainer";
import { canDeleteTickets } from "../../utils/canDeleteTickets";
import { useAcceptTicket } from "../../hooks/useAcceptTicket";
import { isGroupTicket } from "../../utils/isGroupTicket";

const useStyles = makeStyles((theme) => ({
  actionButtons: {
    flex: "none",
    alignSelf: "center",
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    paddingRight: theme.spacing(1),
    paddingLeft: theme.spacing(0.5),
  },
  legacyCluster: {
    marginRight: theme.spacing(0.5),
    "& > *": {
      margin: theme.spacing(0.5),
    },
  },
}));

const TicketActionButtonsCustom = ({
  ticket,
  contact,
  onContactUpdated,
  onOpenQuickReplies,
  onOpenTransfer,
  onCrmDealSaved,
}) => {
  const classes = useStyles();
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [chatbotToggleLoading, setChatbotToggleLoading] = useState(false);
  const { user } = useContext(AuthContext);
  const setCurrentTicket = useContext(TicketsSetContext);
  const inbox = useContext(TicketsInboxContext);
  const planFlags = usePlanFlags();
  const fx = planFlags.effectiveFeatures || {};
  const crmEnabled = fx["crm.pipeline"] === true;
  const crmDenied =
    user?.effectiveUserFeatures?.["crm.pipeline"] === false ||
    (planFlags.ready && !crmEnabled);
  const showCrmSlot = !crmDenied && (crmEnabled || !planFlags.ready);
  const crmFeatureLoading = showCrmSlot && !crmEnabled && !planFlags.ready;
  const mayDelete = canDeleteTickets(user);
  const { completeAcceptTicket } = useAcceptTicket();
  const isGroupConversation = isGroupTicket(ticket);

  const handleAcceptTicket = async () => {
    setLoading(true);
    try {
      await completeAcceptTicket(ticket);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTicketStatus = async (e, status, userId) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${ticket.id}`, {
        status: status,
        userId: userId || null,
        useIntegration: status === "closed" ? false : ticket.useIntegration,
        promptId: status === "closed" ? false : ticket.promptId,
        integrationId: status === "closed" ? false : ticket.integrationId,
      });

      setLoading(false);
      if (status === "open") {
        setCurrentTicket({
          ...ticket,
          status: "open",
          userId: userId || user?.id,
          code: "#reopen",
        });
      } else {
        setCurrentTicket({ id: null, code: null });
        history.push("/tickets");
      }
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  };

  const handleToggleChatbotForContact = async () => {
    if (!contact?.id) return;
    setChatbotToggleLoading(true);
    try {
      const next = !Boolean(contact.chatbotDisabled);
      const { data } = await api.put(`/contacts/${contact.id}/chatbot`, {
        chatbotDisabled: next,
      });
      if (typeof onContactUpdated === "function") {
        onContactUpdated(data);
      }
      toast.success(
        next
          ? i18n.t("contacts.toasts.chatbotDisabled")
          : i18n.t("contacts.toasts.chatbotEnabled")
      );
    } catch (err) {
      toastError(err);
    } finally {
      setChatbotToggleLoading(false);
    }
  };

  if (isGroupConversation) {
    return (
      <div className={classes.actionButtons}>
        <div className={classes.legacyCluster}>
          <TicketTagsButton ticket={ticket} disabled={loading} />
          {contact?.id ? (
            <Tooltip
              title={
                contact.chatbotDisabled
                  ? i18n.t(
                      "ticket.chatbot.enableForContact",
                      "Ativar chatbot para este contato"
                    )
                  : i18n.t(
                      "ticket.chatbot.disableForContact",
                      "Desativar chatbot para este contato"
                    )
              }
            >
              <span>
                <IconButton
                  size="small"
                  onClick={handleToggleChatbotForContact}
                  disabled={loading || chatbotToggleLoading}
                  aria-label={i18n.t("contacts.chatbotToggle")}
                >
                  {contact.chatbotDisabled ? (
                    <SmartToyOutlinedIcon fontSize="small" />
                  ) : (
                    <SmartToyIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
          {showCrmSlot ? (
            <TicketCrmDealButton
              ticket={ticket}
              onCrmDealSaved={onCrmDealSaved}
              disabled={loading}
              featureLoading={crmFeatureLoading}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={classes.actionButtons}>
      {ticket.status === "closed" && (
        <div className={classes.legacyCluster}>
          <TicketTagsButton ticket={ticket} disabled={loading} />
          <ButtonWithSpinner
            loading={loading}
            startIcon={<Replay />}
            size="small"
            onClick={(e) => handleUpdateTicketStatus(e, "open", user?.id)}
          >
            {i18n.t("messagesList.header.buttons.reopen")}
          </ButtonWithSpinner>
        </div>
      )}
      {ticket.status === "open" && (
        <TicketActionModals ticket={ticket}>
          {({ openSchedule, openDelete }) => (
            <TicketConversationActionBar
              loading={loading}
              userProfile={user?.profile}
              showDelete={mayDelete}
              ticketId={ticket.id}
              onResolve={(e) =>
                handleUpdateTicketStatus(e, "closed", user?.id)
              }
              onReturn={(e) => handleUpdateTicketStatus(e, "pending", null)}
              onScheduleClick={openSchedule}
              onTransferClick={onOpenTransfer}
              onDeleteClick={openDelete}
              onQuickRepliesClick={onOpenQuickReplies}
              extraIconActions={
                <>
                  <TicketTagsButton ticket={ticket} disabled={loading} />
                  {contact?.id ? (
                    <Tooltip
                      title={
                        contact.chatbotDisabled
                          ? i18n.t(
                              "ticket.chatbot.enableForContact",
                              "Ativar chatbot para este contato"
                            )
                          : i18n.t(
                              "ticket.chatbot.disableForContact",
                              "Desativar chatbot para este contato"
                            )
                      }
                    >
                      <span>
                        <IconButton
                          size="small"
                          onClick={handleToggleChatbotForContact}
                          disabled={loading || chatbotToggleLoading}
                          aria-label={i18n.t("contacts.chatbotToggle")}
                        >
                          {contact.chatbotDisabled ? (
                            <SmartToyOutlinedIcon fontSize="small" />
                          ) : (
                            <SmartToyIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : null}
                  {showCrmSlot ? (
                    <TicketCrmDealButton
                      ticket={ticket}
                      onCrmDealSaved={onCrmDealSaved}
                      disabled={loading}
                      featureLoading={crmFeatureLoading}
                    />
                  ) : null}
                </>
              }
            />
          )}
        </TicketActionModals>
      )}
      {ticket.status === "pending" && (
        <TicketActionModals
          ticket={ticket}
          deleteTitle={i18n.t("ticket.delete.confirmTitle")}
          deleteMessage={i18n.t("ticket.delete.confirmMessage")}
          onDeleted={() => {
            if (typeof inbox?.removeTicket === "function") {
              inbox.removeTicket(ticket.id);
            }
            setCurrentTicket({ id: null, code: null });
            history.push("/tickets");
          }}
        >
          {({ openDelete }) => (
            <div className={classes.legacyCluster}>
              <TicketTagsButton ticket={ticket} disabled={loading} />
              <ButtonWithSpinner
                loading={loading}
                size="small"
                variant="contained"
                color="primary"
                onClick={handleAcceptTicket}
              >
                {loading
                  ? i18n.t("ticketsList.buttons.accepting")
                  : i18n.t("messagesList.header.buttons.accept")}
              </ButtonWithSpinner>
              <ButtonWithSpinner
                loading={loading}
                size="small"
                variant="outlined"
                onClick={(e) => handleUpdateTicketStatus(e, "closed", user?.id)}
              >
                {i18n.t("messagesList.header.buttons.resolve")}
              </ButtonWithSpinner>
              {mayDelete ? (
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  disabled={loading}
                  onClick={openDelete}
                >
                  {i18n.t("ticketOptionsMenu.buttons.delete")}
                </Button>
              ) : null}
            </div>
          )}
        </TicketActionModals>
      )}
    </div>
  );
};

export default TicketActionButtonsCustom;
