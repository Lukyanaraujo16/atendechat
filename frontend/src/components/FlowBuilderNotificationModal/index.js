import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";
import { Stack, Typography } from "@mui/material";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
}));

const emptyData = () => ({
  phone: "",
  message: "",
});

const FlowBuilderNotificationModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const [activeModal, setActiveModal] = useState(false);
  const [form, setForm] = useState(emptyData());

  useEffect(() => {
    if (open === "edit" && data?.data) {
      setForm({
        phone: data.data.phone ?? "",
        message: data.data.message ?? "",
      });
      setActiveModal(true);
    } else if (open === "create") {
      setForm(emptyData());
      setActiveModal(true);
    } else {
      setActiveModal(false);
    }
  }, [open, data]);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const handleSave = () => {
    const phone = (form.phone || "").trim();
    const message = (form.message || "").trim();
    if (!phone) {
      toast.error("Informe o telefone de destino.");
      return;
    }
    if (!message) {
      toast.error("Informe a mensagem.");
      return;
    }
    const hasVarInPhone = /\{\{[^}]+\}\}/.test(phone);
    if (!hasVarInPhone) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 8) {
        toast.error(
          "Telefone deve ter pelo menos 8 dígitos (após normalizar). Use DDI+DDD+número ou {{variável}}."
        );
        return;
      }
    }
    const payload = { phone, message };
    if (open === "edit") {
      onUpdate({
        ...data,
        data: payload,
      });
    } else {
      onSave(payload);
    }
    handleClose();
  };

  return (
    <AppDialog open={activeModal} onClose={handleClose} fullWidth maxWidth="sm">
      <AppDialogTitle>Notificação (WhatsApp)</AppDialogTitle>
      <AppDialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Envia uma mensagem pelo mesmo WhatsApp da conexão atual, sem abrir outro ticket.
            Use {"{{nome}}"} e variáveis do fluxo; dados do contato com Mustache ({"{{name}}"}, etc.).
          </Typography>
          <TextField
            label="Telefone de destino"
            required
            fullWidth
            size="small"
            variant="outlined"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="5511999998888 ou +55 11 99999-8888"
            helperText="DDI + DDD + número (será normalizado). Pode usar {{variável}}."
          />
          <TextField
            label="Mensagem"
            required
            fullWidth
            multiline
            minRows={4}
            size="small"
            variant="outlined"
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            placeholder="Cliente escolheu financeiro: {{nome}} — protocolo {{protocol}}"
          />
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={handleClose} color="secondary" variant="outlined">
          {i18n.t("contactModal.buttons.cancel")}
        </Button>
        <Button
          color="primary"
          variant="contained"
          className={classes.btnWrapper}
          onClick={handleSave}
        >
          {open === "create" ? "Adicionar" : "Salvar"}
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
};

export default FlowBuilderNotificationModal;
