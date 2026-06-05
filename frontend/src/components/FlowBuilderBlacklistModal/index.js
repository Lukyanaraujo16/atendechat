import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";
import { FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";

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

const FlowBuilderBlacklistModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const [activeModal, setActiveModal] = useState(false);
  const [action, setAction] = useState("add");

  useEffect(() => {
    if (open === "edit" && data?.data) {
      setAction(data.data.action === "remove" ? "remove" : "add");
      setActiveModal(true);
    } else if (open === "create") {
      setAction("add");
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
    if (action !== "add" && action !== "remove") {
      toast.error("Selecione uma ação válida.");
      return;
    }
    const payload = { action };
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
    <AppDialog open={activeModal} onClose={handleClose} fullWidth maxWidth="xs">
      <AppDialogTitle>Blacklist (bot / automações)</AppDialogTitle>
      <AppDialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Aplica no contato deste ticket: bloquear ou reabilitar disparos automáticos do bot (campo
            disableBot no contato).
          </Typography>
          <FormControl fullWidth variant="outlined" size="small">
            <InputLabel id="fb-blacklist-action">Ação</InputLabel>
            <Select
              labelId="fb-blacklist-action"
              label="Ação"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <MenuItem value="add">Adicionar à blacklist (desativar bot)</MenuItem>
              <MenuItem value="remove">Remover da blacklist (reativar bot)</MenuItem>
            </Select>
          </FormControl>
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

export default FlowBuilderBlacklistModal;
