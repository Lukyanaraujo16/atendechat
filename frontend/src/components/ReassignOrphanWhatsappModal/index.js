import React, { useContext, useEffect, useState, useRef } from "react";

import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Typography from "@material-ui/core/Typography";
import Alert from "@material-ui/lab/Alert";

import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import ButtonWithSpinner from "../ButtonWithSpinner";
import { AuthContext } from "../../context/Auth/AuthContext";

const CONNECTED = "CONNECTED";

const ReassignOrphanWhatsappModal = ({
  open,
  onClose,
  ticketId,
  onSuccess,
}) => {
  const { user } = useContext(AuthContext);
  const companyId = user?.companyId;
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [whatsapps, setWhatsapps] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open || !ticketId || !companyId) return;

    setSelectedId("");
    setLoadingList(true);
    const t = setTimeout(() => {
      api
        .get("/whatsapp", { params: { companyId, session: 0 } })
        .then(({ data }) => {
          if (!isMounted.current) return;
          const connected = Array.isArray(data)
            ? data.filter((w) => w.status === CONNECTED)
            : [];
          setWhatsapps(connected);
        })
        .catch((err) => {
          if (!isMounted.current) return;
          toastError(err);
          setWhatsapps([]);
        })
        .finally(() => {
          if (isMounted.current) setLoadingList(false);
        });
    }, 300);

    return () => clearTimeout(t);
  }, [open, ticketId, companyId]);

  const handleConfirm = async () => {
    if (!selectedId || !ticketId) return;
    setSubmitting(true);
    try {
      const { data } = await api.put(`/tickets/${ticketId}/reassign-whatsapp`, {
        whatsappId: Number(selectedId),
      });
      toast.success(i18n.t("ticketsList.orphanReassign.success"));
      if (onSuccess) onSuccess(data);
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{i18n.t("ticketsList.orphanReassign.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("ticketsList.orphanReassign.description")}
        </Typography>
        {loadingList ? (
          <Typography variant="body2" color="textSecondary">
            {i18n.t("ticketsList.orphanReassign.loading")}
          </Typography>
        ) : whatsapps.length === 0 ? (
          <Alert severity="warning">
            {i18n.t("ticketsList.orphanReassign.noConnections")}
          </Alert>
        ) : (
          <FormControl variant="outlined" fullWidth margin="normal">
            <InputLabel id="reassign-whatsapp-label">
              {i18n.t("ticketsList.orphanReassign.connectionLabel")}
            </InputLabel>
            <Select
              labelId="reassign-whatsapp-label"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              label={i18n.t("ticketsList.orphanReassign.connectionLabel")}
            >
              {whatsapps.map((w) => (
                <MenuItem key={w.id} value={String(w.id)}>
                  {w.name || `#${w.id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" disabled={submitting}>
          {i18n.t("ticketsList.orphanReassign.cancel")}
        </Button>
        <ButtonWithSpinner
          loading={submitting}
          color="primary"
          variant="contained"
          disabled={
            submitting || !selectedId || whatsapps.length === 0 || loadingList
          }
          onClick={handleConfirm}
        >
          {i18n.t("ticketsList.orphanReassign.confirm")}
        </ButtonWithSpinner>
      </DialogActions>
    </Dialog>
  );
};

export default ReassignOrphanWhatsappModal;
