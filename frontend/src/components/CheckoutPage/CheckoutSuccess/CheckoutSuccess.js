import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
import { useHistory } from "react-router-dom";
import QRCode from "react-qr-code";
import { Typography, Box, CircularProgress } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import useCheckoutStyles from "../styles";
import { SuccessContent, Total } from "./style";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { FaCopy, FaCheckCircle } from "react-icons/fa";
import { SocketContext } from "../../../context/Socket/SocketContext";
import { useDate } from "../../../hooks/useDate";
import { toast } from "react-toastify";
import { i18n } from "../../../translate/i18n";

const PIX_EXPIRY_SEC = 3600;

function formatPixTotal(pix) {
  if (!pix?.valor) return "—";
  const v = pix.valor;
  const raw =
    typeof v === "object" && v.original != null
      ? v.original
      : typeof v === "string" || typeof v === "number"
      ? v
      : null;
  if (raw == null) return "—";
  const num = parseFloat(String(raw).replace(",", "."));
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function CheckoutSuccess(props) {
  const { pix, invoice } = props;
  const checkoutClasses = useCheckoutStyles();
  const [pixString] = useState(() => pix?.qrcode?.qrcode || "");
  const [copied, setCopied] = useState(false);
  const [paymentState, setPaymentState] = useState("waiting");
  // Cobrança v2 reusada informa o prazo restante; legado: 1 h a partir da exibição.
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Number.isFinite(pix?.expiresInSeconds) && pix.expiresInSeconds > 0
      ? pix.expiresInSeconds
      : PIX_EXPIRY_SEC
  );
  const history = useHistory();
  const { dateToClient } = useDate();
  const socketManager = useContext(SocketContext);
  const paymentHandledRef = useRef(false);

  const totalLabel = useMemo(() => formatPixTotal(pix), [pix]);

  useEffect(() => {
    if (paymentState !== "waiting") return undefined;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          setPaymentState("expired");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [paymentState]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const handler = (data) => {
      if (data.action !== "CONCLUIDA" || paymentHandledRef.current) return;
      paymentHandledRef.current = true;
      setPaymentState("paid");
      toast.success(
        i18n.t("checkoutPage.pix.paidToast", {
          date: dateToClient(data.company?.dueDate),
        })
      );
      setTimeout(() => {
        history.push("/");
      }, 4000);
    };

    socket.on(`company-${companyId}-payment`, handler);
    return () => {
      socket.off(`company-${companyId}-payment`, handler);
    };
  }, [history, socketManager, dateToClient]);

  const handleCopyQR = () => {
    setTimeout(() => {
      setCopied(false);
    }, 1500);
    setCopied(true);
  };

  if (!pix?.qrcode?.qrcode) {
    return (
      <Box py={2} width="100%">
        <Alert severity="error" variant="outlined" className={checkoutClasses.contextAlert}>
          <Typography variant="body2" component="p">
            {i18n.t("checkoutPage.pix.missingQr")}
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <React.Fragment>
      <Total>
        <span>{i18n.t("checkoutPage.pix.totalLabel")}</span>
        <strong>{totalLabel}</strong>
      </Total>

      {invoice && (
        <Typography variant="body2" color="textSecondary" align="center" paragraph>
          {i18n.t("checkoutPage.pix.invoiceRef", {
            id: invoice.id,
            detail: invoice.detail || "",
          })}
        </Typography>
      )}

      {paymentState === "waiting" && (
        <Alert
          severity="info"
          variant="outlined"
          className={checkoutClasses.contextAlertTight}
        >
          <Typography variant="body2" component="p" align="center">
            {i18n.t("checkoutPage.pix.waitingHint", {
              minutes: Math.ceil(secondsLeft / 60),
            })}
          </Typography>
        </Alert>
      )}

      {paymentState === "expired" && (
        <Alert
          severity="warning"
          variant="outlined"
          className={checkoutClasses.contextAlert}
        >
          <Typography variant="body2" component="p" align="center">
            {i18n.t("checkoutPage.pix.expiredHint")}
          </Typography>
        </Alert>
      )}

      {paymentState === "paid" && (
        <Box display="flex" justifyContent="center" alignItems="center" py={2}>
          <CircularProgress size={28} style={{ marginRight: 12 }} />
          <Typography>{i18n.t("checkoutPage.pix.redirecting")}</Typography>
        </Box>
      )}

      {paymentState === "waiting" && (
        <SuccessContent>
          <QRCode value={pixString} size={200} />
          <CopyToClipboard text={pixString} onCopy={handleCopyQR}>
            <button className="copy-button" type="button">
              {copied ? (
                <>
                  <span>{i18n.t("checkoutPage.pix.copied")}</span>
                  <FaCheckCircle size={18} />
                </>
              ) : (
                <>
                  <span>{i18n.t("checkoutPage.pix.copyPix")}</span>
                  <FaCopy size={18} />
                </>
              )}
            </button>
          </CopyToClipboard>
          <span style={{ textAlign: "center", marginTop: 8 }}>
            {i18n.t("checkoutPage.pix.instructions")}
          </span>
        </SuccessContent>
      )}
    </React.Fragment>
  );
}

export default CheckoutSuccess;
