import React, { useEffect, useState, useContext } from "react";
import QRCode from "qrcode.react";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";

import {
  Dialog,
  DialogContent,
  Paper,
  Typography,
  Button,
  Box,
  CircularProgress,
} from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";

const QrcodeModal = ({ open, onClose, whatsAppId }) => {
  const [qrCode, setQrCode] = useState("");
  const [connected, setConnected] = useState(false);
  const [loadingNewQr, setLoadingNewQr] = useState(false);

  const socketManager = useContext(SocketContext);
  const { user } = useContext(AuthContext);
  const authCompanyId = user?.companyId;

  useEffect(() => {
    if (!open) {
      setConnected(false);
      setQrCode("");
    }
  }, [open]);

  useEffect(() => {
    const fetchSession = async () => {
      if (!whatsAppId || !open) return;

      try {
        const { data } = await api.get(`/whatsapp/${whatsAppId}`);
        setQrCode(data.qrcode || "");
      } catch (err) {
        toastError(err);
      }
    };
    fetchSession();
  }, [whatsAppId, open]);

  useEffect(() => {
    if (!whatsAppId) return;
    const companyId =
      authCompanyId != null
        ? String(authCompanyId)
        : localStorage.getItem("companyId");
    if (!companyId) return;
    const socket = socketManager.getSocket(companyId);
    const event = `company-${companyId}-whatsappSession`;

    const handler = (data) => {
      if (data.action !== "update" || data.session?.id !== whatsAppId) return;
      const sid = data.session?.companyId;
      if (
        sid != null &&
        authCompanyId != null &&
        Number(sid) !== Number(authCompanyId)
      ) {
        return;
      }
      const newQr = data.session?.qrcode ?? "";
      setQrCode(newQr);
      if (newQr === "") {
        setConnected(true);
        toast.success(i18n.t("connections.toasts.connected"));
        setTimeout(() => onClose(), 1500);
      }
    };

    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [whatsAppId, onClose, socketManager, authCompanyId]);

  const handleRequestNewQr = async () => {
    if (!whatsAppId) return;
    setLoadingNewQr(true);
    try {
      await api.put(`/whatsappsession/${whatsAppId}`);
      const { data } = await api.get(`/whatsapp/${whatsAppId}`);
      setQrCode(data.qrcode || "");
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingNewQr(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" scroll="paper">
      <DialogContent>
        <Paper elevation={0}>
          <Box display="flex" alignItems="flex-start" flexWrap="wrap" p={1}>
            <Box flex="1" minWidth={240} mr={2} mb={2}>
              <Typography variant="h6" color="textPrimary" gutterBottom>
                {i18n.t("qrCodeModal.title")}
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                1. {i18n.t("qrCodeModal.steps.one")}
              </Typography>
              <Typography variant="body2" color="textPrimary" paragraph>
                2. {i18n.t("qrCodeModal.steps.two.partOne")}{" "}
                {i18n.t("qrCodeModal.steps.two.partTwo")}{" "}
                {i18n.t("qrCodeModal.steps.two.partThree")}
              </Typography>
              <Typography variant="body2" color="textPrimary" paragraph>
                3. {i18n.t("qrCodeModal.steps.three")}
              </Typography>
              <Typography variant="body2" color="textPrimary" paragraph>
                4. {i18n.t("qrCodeModal.steps.four")}
              </Typography>
            </Box>
            <Box display="flex" flexDirection="column" alignItems="center">
              {connected ? (
                <Typography variant="h6" color="primary" style={{ padding: 24 }}>
                  {i18n.t("qrCodeModal.connected")}
                </Typography>
              ) : qrCode ? (
                <>
                  <QRCode value={qrCode} size={256} />
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    onClick={handleRequestNewQr}
                    disabled={loadingNewQr}
                    style={{ marginTop: 16 }}
                    startIcon={loadingNewQr ? <CircularProgress size={16} /> : null}
                  >
                    {i18n.t("qrCodeModal.newQr")}
                  </Button>
                </>
              ) : (
                <Typography variant="body2" color="textSecondary" style={{ padding: 24 }}>
                  {i18n.t("qrCodeModal.waiting")}
                </Typography>
              )}
            </Box>
          </Box>
        </Paper>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(QrcodeModal);
