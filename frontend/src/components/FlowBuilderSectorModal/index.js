import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import {
  makeStyles,
  Button,
  MenuItem,
  Select,
} from "@material-ui/core";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";

import { Stack, CircularProgress } from "@mui/material";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
}));

const FlowBuilderSectorModal = ({ open, onSave, data, onUpdate, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);
  const [activeModal, setActiveModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [queues, setQueues] = useState([]);
  const [selectedQueue, setQueueSelected] = useState("");

  useEffect(() => {
    if (open === "edit" || open === "create") {
      (async () => {
        setLoading(true);
        try {
          const { data: resData } = await api.get("/queue");
          const queuesList = Array.isArray(resData)
            ? resData
            : resData?.queues || resData?.records || [];
          setQueues(queuesList);
          if (open === "edit" && data?.data) {
            const queueId = data.data?.queue?.id ?? data.data?.id;
            const queue = queuesList.find((item) => item.id === queueId);
            if (queue) setQueueSelected(queue.id);
          } else {
            setQueueSelected("");
          }
          setActiveModal(true);
        } catch (error) {
          toastError(error);
        } finally {
          setLoading(false);
        }
      })();
    }
    return () => {
      isMounted.current = false;
    };
  }, [open]);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const handleSave = () => {
    if (loading) {
      toast.error("Aguarde o carregamento dos setores.");
      return;
    }
    const list = Array.isArray(queues) ? queues : [];
    if (list.length === 0) {
      toast.error("Nenhum setor cadastrado. Cadastre filas/setores antes de usar este nó.");
      return;
    }
    if (!selectedQueue) {
      toast.error("Selecione um setor");
      return;
    }
    const queue = queues.find((item) => item.id === selectedQueue);
    if (!queue) return;
    if (open === "edit") {
      onUpdate({ ...data, data: { queue } });
    } else {
      onSave({ data: { queue } });
    }
    handleClose();
  };

  return (
    <div className={classes.root}>
      <AppDialog open={activeModal} onClose={handleClose} fullWidth maxWidth="sm" scroll="paper">
        <AppDialogTitle>
          {open === "create" ? "Adicionar Setor" : "Editar Setor"}
        </AppDialogTitle>
        <Stack>
          <AppDialogContent dividers>
            {loading ? (
              <Stack alignItems="center" py={2}>
                <CircularProgress size={32} />
              </Stack>
            ) : (
              <Select
                value={selectedQueue}
                style={{ width: "100%" }}
                onChange={(e) => setQueueSelected(e.target.value)}
                displayEmpty
                renderValue={(v) => {
                  if (!v) return "Selecione um setor";
                  const q = queues.find((w) => w.id === v);
                  return q ? q.name : "Selecione um setor";
                }}
              >
                <MenuItem value="">
                  <em>Selecione um setor</em>
                </MenuItem>
                {(Array.isArray(queues) ? queues : []).map((queue) => (
                  <MenuItem key={queue.id} value={queue.id}>
                    {queue.name}
                  </MenuItem>
                ))}
              </Select>
            )}
          </AppDialogContent>
          <AppDialogActions>
            <Button onClick={handleClose} color="secondary" variant="outlined">
              {i18n.t("contactModal.buttons.cancel")}
            </Button>
            <Button
              color="primary"
              variant="contained"
              onClick={handleSave}
              disabled={loading}
            >
              {open === "create" ? "Adicionar" : "Editar"}
            </Button>
          </AppDialogActions>
        </Stack>
      </AppDialog>
    </div>
  );
};

export default FlowBuilderSectorModal;
