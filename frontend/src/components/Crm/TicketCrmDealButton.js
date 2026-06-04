import React, { useContext, useMemo, useState } from "react";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";
import BusinessCenterOutlinedIcon from "@material-ui/icons/BusinessCenterOutlined";
import moment from "moment";

import { i18n } from "../../translate/i18n";
import CrmDealFormDialog from "./CrmDealFormDialog";
import CrmOpenDealsChoiceDialog from "./CrmOpenDealsChoiceDialog";
import { AuthContext } from "../../context/Auth/AuthContext";
import { getCrmTerminology } from "../../utils/crmTerminology";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { isForbiddenPermissionError } from "../../utils/apiErrorUtils";

function buildTicketCrmNotes(ticket) {
  const contactName = ticket.contact?.name || "";
  const number = ticket.contact?.number || "";
  const last = ticket.lastMessage
    ? String(ticket.lastMessage).trim().slice(0, 280)
    : "";
  const ticketDate = ticket.updatedAt || ticket.createdAt
    ? moment(ticket.updatedAt || ticket.createdAt).format("LL LTS")
    : "";
  const lines = [
    i18n.t("crm.ticket.notesHeader"),
    `${i18n.t("crm.ticket.notesContact")}: ${contactName || "—"}`,
    number ? `${i18n.t("crm.ticket.notesNumber")}: ${number}` : null,
    `${i18n.t("crm.ticket.notesTicket")}: #${ticket.id}`,
    ticketDate ? `${i18n.t("crm.ticket.notesDate")}: ${ticketDate}` : null,
    last ? `${i18n.t("crm.ticket.notesLastMessage")}: ${last}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export default function TicketCrmDealButton({
  ticket,
  onCrmDealSaved,
  disabled = false,
  featureLoading = false,
}) {
  const [crmOpen, setCrmOpen] = useState(false);
  const [crmDealId, setCrmDealId] = useState(null);
  const [dupOpen, setDupOpen] = useState(false);
  const [dupDeals, setDupDeals] = useState([]);
  const [opening, setOpening] = useState(false);
  const { user } = useContext(AuthContext);
  const terminology = useMemo(
    () => getCrmTerminology(user?.company?.businessSegment),
    [user?.company?.businessSegment]
  );

  const isDisabled =
    disabled || featureLoading || opening || !ticket?.id || !ticket?.contactId;

  const tooltipTitle = featureLoading
    ? i18n.t("crm.ticket.loadingCrm")
    : i18n.t("crm.ticket.createOpportunity");

  if (!ticket?.id) {
    return (
      <Tooltip title={tooltipTitle}>
        <span>
          <IconButton size="small" disabled aria-label={tooltipTitle}>
            {featureLoading ? (
              <CircularProgress size={18} />
            ) : (
              <BusinessCenterOutlinedIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  const contactName = ticket.contact?.name || "";

  const assignee =
    ticket.userId != null && ticket.userId !== ""
      ? Number(ticket.userId)
      : user?.id != null
        ? Number(user.id)
        : "";

  const notes = buildTicketCrmNotes(ticket);

  const formDefaults = {
    title: contactName || i18n.t("crm.deal.fields.title"),
    contactId: ticket.contactId,
    ticketId: ticket.id,
    source: "whatsapp",
    assignedUserId: assignee,
    notes,
    priority: "medium",
  };

  const handleOpenRequest = async () => {
    if (isDisabled) return;
    setOpening(true);
    try {
      const { data } = await api.get(`/crm/deals/by-contact/${ticket.contactId}`);
      const openList = (Array.isArray(data) ? data : []).filter(
        (d) => d.status === "open"
      );
      if (openList.length > 0) {
        setDupDeals(openList);
        setDupOpen(true);
        return;
      }
    } catch (e) {
      if (!isForbiddenPermissionError(e)) {
        toastError(e);
      }
      return;
    } finally {
      setOpening(false);
    }
    setCrmDealId(null);
    setCrmOpen(true);
  };

  const handleCrmSaved = () => {
    setCrmOpen(false);
    setCrmDealId(null);
    if (typeof onCrmDealSaved === "function") {
      onCrmDealSaved();
    }
  };

  return (
    <>
      <Tooltip title={tooltipTitle}>
        <span>
          <IconButton
            size="small"
            onClick={handleOpenRequest}
            disabled={isDisabled}
            aria-label={tooltipTitle}
          >
            {featureLoading || opening ? (
              <CircularProgress size={18} />
            ) : (
              <BusinessCenterOutlinedIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>
      <CrmOpenDealsChoiceDialog
        open={dupOpen}
        onClose={() => setDupOpen(false)}
        deals={dupDeals}
        onSelectDeal={(id) => {
          setDupOpen(false);
          setCrmDealId(id);
          setCrmOpen(true);
        }}
        onCreateNew={() => {
          setDupOpen(false);
          setCrmDealId(null);
          setCrmOpen(true);
        }}
      />
      <CrmDealFormDialog
        open={crmOpen}
        onClose={() => {
          setCrmOpen(false);
          setCrmDealId(null);
        }}
        dealId={crmDealId}
        terminology={terminology}
        defaults={crmDealId ? {} : formDefaults}
        onSaved={handleCrmSaved}
      />
    </>
  );
}
