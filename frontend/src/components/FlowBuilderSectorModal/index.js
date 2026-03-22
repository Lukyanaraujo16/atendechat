import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import {
  makeStyles,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
} from "@material-ui/core";
import { Stack } from "@mui/material";
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
  const [queues, setQueues] = useState([]);
  const [selectedQueue, setQueueSelected] = useState("");

  useEffect(() => {
    if (open === "edit" || open === "create") {
      (async () => {
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
      <Dialog open={activeModal} onClose={handleClose} fullWidth maxWidth="sm" scroll="paper">
        <DialogTitle>
          {open === "create" ? "Adicionar Setor" : "Editar Setor"}
        </DialogTitle>
        <Stack>
          <DialogContent dividers>
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
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} color="secondary" variant="outlined">
              {i18n.t("contactModal.buttons.cancel")}
            </Button>
            <Button color="primary" variant="contained" onClick={handleSave}>
              {open === "create" ? "Adicionar" : "Editar"}
            </Button>
          </DialogActions>
        </Stack>
      </Dialog>
    </div>
  );
};

export default FlowBuilderSectorModal;
