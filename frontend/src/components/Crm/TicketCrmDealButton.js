import React, { useState } from "react";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import BusinessCenterOutlinedIcon from "@material-ui/icons/BusinessCenterOutlined";

import { i18n } from "../../translate/i18n";
import CrmDealFormDialog from "../Crm/CrmDealFormDialog";

export default function TicketCrmDealButton({ ticket }) {
  const [open, setOpen] = useState(false);
  if (!ticket?.contactId) return null;

  const contactName = ticket.contact?.name || "";

  return (
    <>
      <Tooltip title={i18n.t("crm.ticket.createOpportunity")}>
        <IconButton
          size="small"
          onClick={() => setOpen(true)}
          aria-label={i18n.t("crm.ticket.createOpportunity")}
        >
          <BusinessCenterOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <CrmDealFormDialog
        open={open}
        onClose={() => setOpen(false)}
        defaults={{
          title: contactName || i18n.t("crm.deal.fields.title"),
          contactId: ticket.contactId,
          ticketId: ticket.id,
          source: "whatsapp",
        }}
        onSaved={() => setOpen(false)}
      />
    </>
  );
}
