import React, { useState, useEffect, useContext } from "react";
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
import { FormControl, InputLabel, MenuItem, Select, Stack, CircularProgress } from "@mui/material";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

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

const FlowBuilderFlowUpModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const companyId = user?.companyId;
  const [activeModal, setActiveModal] = useState(false);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (open === "edit" && data?.data?.contactList) {
      setSelectedId(String(data.data.contactList.id || ""));
      setActiveModal(true);
    } else if (open === "create") {
      setSelectedId("");
      setActiveModal(true);
    } else {
      setActiveModal(false);
    }
  }, [open, data]);

  useEffect(() => {
    if (!activeModal || !companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: res } = await api.get("/contact-lists/list", {
          params: { companyId },
        });
        const arr = Array.isArray(res) ? res : [];
        if (!cancelled) setLists(arr);
      } catch (e) {
        toastError(e);
        if (!cancelled) setLists([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeModal, companyId]);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const handleSave = () => {
    if (!loading && lists.length === 0) {
      toast.error("Nenhuma lista de contatos cadastrada. Crie uma lista antes de usar este nó.");
      return;
    }
    const id = parseInt(selectedId, 10);
    if (!id || Number.isNaN(id)) {
      toast.error("Selecione uma lista de contatos.");
      return;
    }
    const list = lists.find((x) => x.id === id);
    const payload = {
      contactList: {
        id,
        name: list?.name || "",
      },
    };
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
      <AppDialogTitle>FlowUp (lista / remarketing)</AppDialogTitle>
      <AppDialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {loading ? (
            <Stack alignItems="center" py={2}>
              <CircularProgress size={32} />
            </Stack>
          ) : (
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel id="fb-flowup-label">Lista de contatos</InputLabel>
              <Select
                labelId="fb-flowup-label"
                label="Lista de contatos"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <MenuItem value="">
                  <em>Selecione…</em>
                </MenuItem>
                {lists.map((l) => (
                  <MenuItem key={l.id} value={String(l.id)}>
                    {l.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
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
          disabled={loading}
        >
          {open === "create" ? "Adicionar" : "Salvar"}
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
};

export default FlowBuilderFlowUpModal;
