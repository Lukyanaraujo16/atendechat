import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from "react";
import QRCode from "react-qr-code";
import { Typography, Box } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import useCheckoutStyles from "../styles";
import { SuccessContent, Total } from "./style";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { FaCopy, FaCheckCircle } from "react-icons/fa";
import { SocketContext } from "../../../context/Socket/SocketContext";
import { useDate } from "../../../hooks/useDate";
import { toast } from "react-toastify";
import api from "../../../services/api";
import { i18n } from "../../../translate/i18n";

const PIX_EXPIRY_SEC = 3600;
/** Consulta leve da fatura enquanto aguarda: reserva para socket perdido ou reconexão. */
export const PIX_STATUS_POLL_MS = 10000;
/** O backend emite `paid` (confirmGatewayPayment); `CONCLUIDA` mantido por compatibilidade. */
const PAID_SOCKET_ACTIONS = ["paid", "CONCLUIDA"];

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
  const [renewedUntil, setRenewedUntil] = useState(null);
  const [checkFailed, setCheckFailed] = useState(false);
  // Cobrança v2 reusada informa o prazo restante; legado: 1 h a partir da exibição.
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Number.isFinite(pix?.expiresInSeconds) && pix.expiresInSeconds > 0
      ? pix.expiresInSeconds
      : PIX_EXPIRY_SEC
  );
  const { dateToClient } = useDate();
  const socketManager = useContext(SocketContext);
  const paymentHandledRef = useRef(false);
  const mountedRef = useRef(true);
  const invoiceId = invoice?.id;

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  // Fonte da verdade: status persistido da fatura (GET /invoices/:id, filtrado pela empresa do usuário).
  const checkInvoice = useCallback(async () => {
    if (!invoiceId || paymentHandledRef.current) return;
    try {
      const { data } = await api.get(`/invoices/${invoiceId}`);
      if (!mountedRef.current) return; // modal fechado durante a consulta
      setCheckFailed(false);
      if (String(data?.status).toLowerCase() !== "paid" || paymentHandledRef.current) return;
      paymentHandledRef.current = true;
      setPaymentState("paid");
      toast.success(i18n.t("checkoutPage.pix.paidTitle"));
    } catch {
      // Falha temporária de rede: não muda o estado do pagamento; a próxima consulta tenta de novo.
      if (mountedRef.current) setCheckFailed(true);
    }
  }, [invoiceId]);

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

  // Aguardando: consulta já ao abrir (fatura pode estar paga) e a cada PIX_STATUS_POLL_MS.
  // Expirada: uma última consulta (pagamento feito pouco antes de expirar). Para ao pagar ou desmontar.
  useEffect(() => {
    if (paymentState === "expired") {
      checkInvoice();
      return undefined;
    }
    if (paymentState !== "waiting") return undefined;
    checkInvoice();
    const t = setInterval(checkInvoice, PIX_STATUS_POLL_MS);
    return () => clearInterval(t);
  }, [paymentState, checkInvoice]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    // O evento é da empresa (qualquer pagamento): só a fatura persistida confirma este.
    const handler = (data) => {
      if (!PAID_SOCKET_ACTIONS.includes(data?.action)) return;
      if (data.company?.dueDate) setRenewedUntil(data.company.dueDate);
      checkInvoice();
    };

    socket.on(`company-${companyId}-payment`, handler);
    return () => {
      socket.off(`company-${companyId}-payment`, handler);
    };
  }, [socketManager, checkInvoice]);

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
          {checkFailed && (
            <Typography variant="caption" component="p" align="center">
              {i18n.t("checkoutPage.pix.checkRetrying")}
            </Typography>
          )}
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
        <Box py={2} width="100%">
          <Alert severity="success" variant="outlined" role="status">
            <Typography variant="h6" component="p">
              {i18n.t("checkoutPage.pix.paidTitle")}
            </Typography>
            {renewedUntil && (
              <Typography variant="body2" component="p">
                {i18n.t("checkoutPage.pix.paidRenewed", {
                  date: dateToClient(renewedUntil),
                })}
              </Typography>
            )}
            <Typography variant="body2" component="p">
              {i18n.t("checkoutPage.pix.paidCloseHint")}
            </Typography>
          </Alert>
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
