import React from "react";
import {
  Button,
  Typography,
} from "@material-ui/core";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";

import { i18n } from "../../translate/i18n";

const FlowBuilderCloseTicketModal = ({ open, onSave, data, onUpdate, close }) => {
  const [activeModal, setActiveModal] = React.useState(false);

  React.useEffect(() => {
    if (open === "edit" || open === "create") {
      setActiveModal(true);
    }
  }, [open]);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const handleConfirm = () => {
    if (open === "edit") {
      onUpdate({ ...data, data: data?.data || {} });
    } else {
      onSave({ data: {} });
    }
    handleClose();
  };

  if (!activeModal) return null;

  return (
    <AppDialog open={activeModal} onClose={handleClose} fullWidth maxWidth="xs">
      <AppDialogTitle>
        {open === "create" ? "Adicionar Encerrar Ticket" : "Encerrar Ticket"}
      </AppDialogTitle>
      <AppDialogContent dividers>
        <Typography variant="body2" color="textSecondary">
          Este nó finaliza o atendimento ao ser executado no fluxo. O ticket será marcado como encerrado.
        </Typography>
        {/* Espaço reservado para configurações futuras (ex: mensagem de despedida) */}
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={handleClose} color="secondary" variant="outlined">
          {i18n.t("contactModal.buttons.cancel")}
        </Button>
        <Button color="primary" variant="contained" onClick={handleConfirm}>
          {open === "create" ? "Adicionar" : "OK"}
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
};

export default FlowBuilderCloseTicketModal;
