import React, { useEffect, useRef, useState } from "react";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ConfirmationModal from "../ConfirmationModal";
import TransferTicketModalCustom from "../TransferTicketModalCustom";
import toastError from "../../errors/toastError";
import ScheduleModal from "../ScheduleModal";

/**
 * Encapsula modais de agendamento, transferência e exclusão de ticket.
 * Usa render props: children({ openSchedule, openTransfer, openDelete })
 */
const TicketActionModals = ({ ticket, children }) => {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [transferTicketModalOpen, setTransferTicketModalOpen] = useState(false);
  const isMounted = useRef(true);

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [contactId, setContactId] = useState(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleDeleteTicket = async () => {
    try {
      await api.delete(`/tickets/${ticket.id}`);
    } catch (err) {
      toastError(err);
    }
  };

  const openDelete = () => {
    setConfirmationOpen(true);
  };

  const openTransfer = () => {
    setTransferTicketModalOpen(true);
  };

  const handleCloseTransferTicketModal = () => {
    if (isMounted.current) {
      setTransferTicketModalOpen(false);
    }
  };

  const openSchedule = () => {
    if (!ticket.contact?.id) return;
    setContactId(ticket.contact.id);
    setScheduleModalOpen(true);
  };

  const handleCloseScheduleModal = () => {
    setScheduleModalOpen(false);
    setContactId(null);
  };

  return (
    <>
      {typeof children === "function"
        ? children({ openSchedule, openTransfer, openDelete })
        : children}
      <ConfirmationModal
        title={`${i18n.t("ticketOptionsMenu.confirmationModal.title")}${
          ticket.id
        } ${i18n.t("ticketOptionsMenu.confirmationModal.titleFrom")} ${
          ticket.contact.name
        }?`}
        open={confirmationOpen}
        onClose={setConfirmationOpen}
        onConfirm={handleDeleteTicket}
      >
        {i18n.t("ticketOptionsMenu.confirmationModal.message")}
      </ConfirmationModal>
      <TransferTicketModalCustom
        modalOpen={transferTicketModalOpen}
        onClose={handleCloseTransferTicketModal}
        ticketid={ticket.id}
      />
      <ScheduleModal
        open={scheduleModalOpen}
        onClose={handleCloseScheduleModal}
        aria-labelledby="form-dialog-title"
        contactId={contactId}
      />
    </>
  );
};

export default TicketActionModals;
