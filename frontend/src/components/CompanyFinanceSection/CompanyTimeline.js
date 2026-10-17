import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Link, Typography } from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";
import Alert from "@material-ui/lab/Alert";
import ReceiptIcon from "@material-ui/icons/Receipt";
import EditIcon from "@material-ui/icons/Edit";
import CancelIcon from "@material-ui/icons/Cancel";
import PaymentIcon from "@material-ui/icons/Payment";
import AccountBalanceIcon from "@material-ui/icons/AccountBalance";
import HistoryIcon from "@material-ui/icons/History";
import CardGiftcardIcon from "@material-ui/icons/CardGiftcard";
import AutorenewIcon from "@material-ui/icons/Autorenew";
import EventIcon from "@material-ui/icons/Event";
import LockIcon from "@material-ui/icons/Lock";
import LockOpenIcon from "@material-ui/icons/LockOpen";
import FindInPageIcon from "@material-ui/icons/FindInPage";
import BusinessIcon from "@material-ui/icons/Business";
import PersonIcon from "@material-ui/icons/Person";
import FiberManualRecordIcon from "@material-ui/icons/FiberManualRecord";
import SkipNextIcon from "@material-ui/icons/SkipNext";

import api from "../../services/api";
import { AppLoadingState, AppEmptyState, AppSecondaryButton } from "../../ui";
import showFinanceError from "./financeErrors";
import { formatBrl, formatDate, formatDateTime, isNotFoundRoute } from "./financeFormat";

export const TIMELINE_PAGE_SIZE = 30;

/** kind (C4) → rótulo, ícone e cor. */
export const TIMELINE_KINDS = {
  invoice_created: { label: "Fatura criada", Icon: ReceiptIcon, tone: "info" },
  invoice_updated: { label: "Fatura editada", Icon: EditIcon, tone: "info" },
  invoice_cancelled: { label: "Fatura cancelada", Icon: CancelIcon, tone: "default" },
  payment_manual: { label: "Pagamento registrado (manual)", Icon: PaymentIcon, tone: "success" },
  payment_gateway: { label: "Pagamento confirmado pela Efí", Icon: AccountBalanceIcon, tone: "success" },
  payment_historical: { label: "Pagamento histórico (sem renovação)", Icon: HistoryIcon, tone: "historical" },
  courtesy: { label: "Cortesia (sem receita)", Icon: CardGiftcardIcon, tone: "secondary" },
  courtesy_historical: { label: "Cortesia histórica (sem receita)", Icon: CardGiftcardIcon, tone: "secondary" },
  renewal_payment: { label: "Renovação por pagamento", Icon: AutorenewIcon, tone: "success" },
  renewal_admin: { label: "Renovação administrativa (sem receita)", Icon: AutorenewIcon, tone: "warning" },
  renewal_skipped: { label: "Renovação não aplicada (período já coberto)", Icon: SkipNextIcon, tone: "default" },
  due_date_adjusted: { label: "Vencimento ajustado", Icon: EventIcon, tone: "warning" },
  due_date_manual_edit: { label: "Vencimento editado no cadastro", Icon: EventIcon, tone: "warning" },
  block_manual: { label: "Bloqueio manual", Icon: LockIcon, tone: "error" },
  block_auto: { label: "Bloqueio automático (atraso)", Icon: LockIcon, tone: "error" },
  unblock: { label: "Desbloqueio", Icon: LockOpenIcon, tone: "success" },
  unblock_after_renew: { label: "Desbloqueio após renovação", Icon: LockOpenIcon, tone: "success" },
  historical_review: { label: "Revisão de fatura antiga", Icon: FindInPageIcon, tone: "historical" },
  registration_update: { label: "Cadastro alterado", Icon: BusinessIcon, tone: "default" },
  user_admin: { label: "Usuário da empresa alterado", Icon: PersonIcon, tone: "default" },
  other: { label: "Outro evento", Icon: FiberManualRecordIcon, tone: "default" },
};

export function timelineKindInfo(kind) {
  return TIMELINE_KINDS[String(kind || "").toLowerCase()] || TIMELINE_KINDS.other;
}

const useStyles = makeStyles((theme) => {
  const toneColor = {
    success: theme.palette.success.main,
    warning: theme.palette.warning.dark,
    error: theme.palette.error.main,
    info: theme.palette.info.main,
    secondary: theme.palette.secondary.main,
    historical: theme.palette.info.dark,
    default: theme.palette.text.secondary,
  };
  const tones = {};
  Object.keys(toneColor).forEach((k) => {
    tones[`tone_${k}`] = {
      color: toneColor[k],
      backgroundColor: alpha(toneColor[k], 0.12),
      ...(k === "historical" ? { border: `1px dashed ${toneColor[k]}` } : {}),
    };
  });
  return {
    list: { listStyle: "none", margin: 0, padding: 0 },
    item: {
      display: "flex",
      gap: theme.spacing(1.5),
      padding: theme.spacing(1.25, 0),
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
    icon: {
      width: 34,
      height: 34,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    body: { flex: 1, minWidth: 0 },
    top: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: theme.spacing(1),
    },
    title: { fontWeight: 600, fontSize: "0.9rem", wordBreak: "break-word" },
    amount: { fontWeight: 700, fontSize: "0.9rem", whiteSpace: "nowrap" },
    meta: { fontSize: "0.78rem", color: theme.palette.text.secondary, marginTop: 2 },
    note: { fontSize: "0.8rem", marginTop: 4, wordBreak: "break-word" },
    mb: { marginBottom: theme.spacing(2) },
    ...tones,
  };
});

function detailNote(details) {
  if (!details || typeof details !== "object") return null;
  return details.reason || details.note || details.justification || null;
}

/**
 * Linha do tempo da empresa (C4): GET /saas/companies/:companyId/timeline?before=&limit=30.
 * Props: { companyId, reloadKey, onOpenInvoice(invoiceId) }
 */
export default function CompanyTimeline({ companyId, reloadKey, onOpenInvoice }) {
  const classes = useStyles();
  const [items, setItems] = useState([]);
  const [nextBefore, setNextBefore] = useState(null);
  const [historyStartsAt, setHistoryStartsAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [failed, setFailed] = useState(false);
  const seqRef = useRef(0);

  const load = useCallback(
    async (before) => {
      if (!companyId) return;
      const seq = before ? seqRef.current : ++seqRef.current;
      if (before) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = { limit: TIMELINE_PAGE_SIZE };
        if (before) params.before = before;
        const { data } = await api.get(`/saas/companies/${companyId}/timeline`, { params });
        if (seq !== seqRef.current) return;
        const list = Array.isArray(data?.items) ? data.items : [];
        setItems((prev) => {
          if (!before) return list;
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...list.filter((i) => !seen.has(i.id))];
        });
        setNextBefore(data?.nextBefore || null);
        setHistoryStartsAt(data?.historyStartsAt || null);
        setUnavailable(false);
        setFailed(false);
      } catch (err) {
        if (seq !== seqRef.current) return;
        if (isNotFoundRoute(err)) {
          setUnavailable(true);
        } else {
          if (!before) setFailed(true);
          showFinanceError(err, "A linha do tempo");
        }
      } finally {
        if (seq === seqRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [companyId]
  );

  useEffect(() => {
    load(null);
  }, [load, reloadKey]);

  if (loading && !items.length) return <AppLoadingState message="Carregando linha do tempo…" />;

  if (unavailable) {
    return (
      <Alert severity="info">
        A linha do tempo ainda não está disponível neste servidor. Enquanto isso, consulte as guias
        Pagamentos, Renovações e Auditoria.
      </Alert>
    );
  }

  if (failed && !items.length) {
    return (
      <Alert
        severity="warning"
        action={
          <AppSecondaryButton size="small" onClick={() => load(null)}>
            Tentar novamente
          </AppSecondaryButton>
        }
      >
        Não foi possível carregar a linha do tempo.
      </Alert>
    );
  }

  const historyNotice = historyStartsAt ? (
    <Alert severity="info" className={classes.mb}>
      Antes de {formatDate(historyStartsAt)} não há histórico detalhado registrado. Eventos
      anteriores (pagamentos, renovações, bloqueios) podem ter acontecido sem registro aqui.
    </Alert>
  ) : null;

  if (!items.length) {
    return (
      <>
        {historyNotice}
        <AppEmptyState title="Nenhum evento registrado" />
      </>
    );
  }

  return (
    <Box>
      {historyNotice}
      <ul className={classes.list} aria-label="Linha do tempo">
        {items.map((it) => {
          const info = timelineKindInfo(it.kind);
          const Icon = info.Icon;
          const note = detailNote(it.details);
          return (
            <li key={it.id} className={classes.item} data-testid="timeline-item">
              <span className={`${classes.icon} ${classes[`tone_${info.tone}`]}`} title={info.label}>
                <Icon fontSize="small" />
              </span>
              <Box className={classes.body}>
                <Box className={classes.top}>
                  <span className={classes.title}>
                    {info.label}
                    {it.title && it.title !== info.label ? (
                      <Typography component="span" variant="body2" color="textSecondary">
                        {" "}
                        — {it.title}
                      </Typography>
                    ) : null}
                  </span>
                  {it.amount !== null && it.amount !== undefined ? (
                    <span className={classes.amount}>{formatBrl(it.amount)}</span>
                  ) : null}
                </Box>
                <div className={classes.meta}>
                  {formatDateTime(it.occurredAt)}
                  {" · "}
                  {it.actor?.name ? `por ${it.actor.name}` : "sistema / não identificado"}
                  {it.invoiceId ? (
                    <>
                      {" · "}
                      <Link
                        component="button"
                        variant="body2"
                        style={{ fontSize: "inherit", verticalAlign: "baseline" }}
                        onClick={() => onOpenInvoice && onOpenInvoice(it.invoiceId)}
                      >
                        Fatura #{it.invoiceId}
                      </Link>
                    </>
                  ) : null}
                </div>
                {note ? <div className={classes.note}>“{note}”</div> : null}
              </Box>
            </li>
          );
        })}
      </ul>
      {nextBefore ? (
        <Box display="flex" justifyContent="center" mt={2}>
          <AppSecondaryButton loading={loadingMore} onClick={() => load(nextBefore)}>
            Carregar mais
          </AppSecondaryButton>
        </Box>
      ) : null}
    </Box>
  );
}
