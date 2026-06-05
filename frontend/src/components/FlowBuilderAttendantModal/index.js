import React, { useState, useEffect, useRef } from "react";
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

const FlowBuilderAttendantModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);
  const [activeModal, setActiveModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (open === "edit" && data?.data?.user) {
      setSelectedId(String(data.data.user.id || ""));
      setActiveModal(true);
    } else if (open === "create") {
      setSelectedId("");
      setActiveModal(true);
    } else {
      setActiveModal(false);
    }
  }, [open, data]);

  useEffect(() => {
    if (!activeModal) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: list } = await api.get("/users/list");
        const arr = Array.isArray(list) ? list : [];
        if (!cancelled) setUsers(arr.map((u) => ({ id: u.id, name: u.name })));
      } catch (e) {
        toastError(e);
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeModal]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const handleSave = () => {
    if (!loading && users.length === 0) {
      toast.error("Nenhum usuário disponível para transferência.");
      return;
    }
    const id = parseInt(selectedId, 10);
    if (!id || Number.isNaN(id)) {
      toast.error("Selecione um atendente.");
      return;
    }
    const u = users.find((x) => x.id === id);
    const payload = {
      user: {
        id,
        name: u?.name || "",
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
    <div>
      <AppDialog open={activeModal} onClose={handleClose} fullWidth maxWidth="sm">
        <AppDialogTitle>Atendente</AppDialogTitle>
        <AppDialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {loading ? (
              <Stack alignItems="center" py={2}>
                <CircularProgress size={32} />
              </Stack>
            ) : (
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel id="fb-attendant-label">Transferir para</InputLabel>
                <Select
                  labelId="fb-attendant-label"
                  label="Transferir para"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Selecione…</em>
                  </MenuItem>
                  {users.map((u) => (
                    <MenuItem key={u.id} value={String(u.id)}>
                      {u.name}
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
    </div>
  );
};

export default FlowBuilderAttendantModal;
