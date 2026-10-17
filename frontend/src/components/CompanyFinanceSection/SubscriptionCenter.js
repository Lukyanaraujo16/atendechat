import React from "react";
import { Box, Button, Tooltip, Typography } from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";
import Alert from "@material-ui/lab/Alert";
import AddIcon from "@material-ui/icons/Add";
import AutorenewIcon from "@material-ui/icons/Autorenew";
import CardGiftcardIcon from "@material-ui/icons/CardGiftcard";
import EventIcon from "@material-ui/icons/Event";
import PaymentIcon from "@material-ui/icons/Payment";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";

import { AppLoadingState, AppPrimaryButton, AppSecondaryButton } from "../../ui";
import { ToneChip, PaymentKindChip } from "./FinanceChips";
import {
  formatBrl,
  formatDate,
  formatPaidDate,
  methodLabel,
  recurrenceLabel,
} from "./financeFormat";
import {
  STATUS_EXPLANATION,
  daysText,
  financialStatusInfo,
  operationalStatusInfo,
  subscriptionStatusInfo,
} from "./subscriptionStatus";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    background: alpha(theme.palette.primary.main, theme.palette.type === "dark" ? 0.06 : 0.025),
    marginBottom: theme.spacing(2),
  },
  head: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    [theme.breakpoints.down("xs")]: {
      width: "100%",
      "& > *": { flex: "1 1 auto" },
    },
  },
  statusRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
  },
  statusBox: {
    padding: theme.spacing(1.25, 1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
  },
  cell: {
    padding: theme.spacing(1.25, 1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    minWidth: 0,
  },
  label: {
    fontSize: "0.7rem",
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  value: { fontWeight: 700, fontSize: "1rem", wordBreak: "break-word" },
  hint: { fontSize: "0.75rem", color: theme.palette.text.secondary, marginTop: 2 },
  pendencies: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
  },
  pendencyBtn: { textTransform: "none" },
  explanation: {
    display: "flex",
    gap: theme.spacing(0.75),
    alignItems: "flex-start",
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },
  courtesyBtn: {
    color: theme.palette.secondary.main,
    borderColor: alpha(theme.palette.secondary.main, 0.6),
    borderStyle: "dashed",
    "&:hover": {
      borderStyle: "dashed",
      backgroundColor: alpha(theme.palette.secondary.main, 0.08),
    },
  },
}));

function StatusBox({ title, info, extra }) {
  const classes = useStyles();
  return (
    <Box className={classes.statusBox}>
      <div className={classes.label}>{title}</div>
      <ToneChip label={info.label} tone={info.tone} tooltip={info.help || undefined} />
      {extra ? <div className={classes.hint}>{extra}</div> : null}
    </Box>
  );
}

function Cell({ label, value, hint }) {
  const classes = useStyles();
  return (
    <Box className={classes.cell}>
      <div className={classes.label}>{label}</div>
      <div className={classes.value}>{value}</div>
      {hint ? <div className={classes.hint}>{hint}</div> : null}
    </Box>
  );
}

/**
 * Central de assinatura (topo da guia Financeiro).
 * Props: { state: {data, loading, unavailable, error}, onAction(name), onPendency(name), onReload }
 * Ações: "payment" | "invoice" | "renew" | "adjust" | "courtesy".
 */
export default function SubscriptionCenter({ state, onAction, onPendency, onReload }) {
  const classes = useStyles();
  const data = state?.data;
  const status = data?.status || {};
  const pend = data?.pendencies || {};
  const last = data?.lastConfirmedPayment;
  const next = data?.nextExpectedCharge;
  const act = (name) => () => onAction && onAction(name);
  const pendClick = (name) => () => onPendency && onPendency(name);

  const actions = (
    <Box className={classes.actions}>
      <AppPrimaryButton startIcon={<PaymentIcon />} onClick={act("payment")}>
        Registrar pagamento
      </AppPrimaryButton>
      <AppSecondaryButton startIcon={<AddIcon />} onClick={act("invoice")}>
        Gerar fatura
      </AppSecondaryButton>
      <AppSecondaryButton startIcon={<AutorenewIcon />} onClick={act("renew")}>
        Renovar
      </AppSecondaryButton>
      <AppSecondaryButton startIcon={<EventIcon />} onClick={act("adjust")}>
        Ajustar vencimento
      </AppSecondaryButton>
      <Tooltip title="Quita a fatura sem recebimento de dinheiro. Não conta como receita.">
        <Button
          variant="outlined"
          className={classes.courtesyBtn}
          startIcon={<CardGiftcardIcon />}
          onClick={act("courtesy")}
        >
          Conceder cortesia
        </Button>
      </Tooltip>
    </Box>
  );

  let body;
  if (state?.loading && !data) {
    body = <AppLoadingState message="Carregando assinatura…" />;
  } else if (!data) {
    body = state?.unavailable ? (
      <Alert severity="info">
        A Central de assinatura ainda não está disponível neste servidor. As ações abaixo e as
        guias de cobranças continuam funcionando.
      </Alert>
    ) : (
      <Alert
        severity="warning"
        action={
          onReload ? (
            <AppSecondaryButton size="small" onClick={onReload}>
              Tentar novamente
            </AppSecondaryButton>
          ) : null
        }
      >
        Não foi possível carregar o resumo da assinatura.
      </Alert>
    );
  } else {
    const op = operationalStatusInfo(status.operational, status.blockKind);
    const fin = financialStatusInfo(status.financial);
    const sub = subscriptionStatusInfo(status.subscription);
    const hasPend =
      Number(pend.openInvoices) > 0 ||
      Number(pend.reconciliationPending) > 0 ||
      Number(pend.historicalReviewPending) > 0;
    body = (
      <>
        <Box className={classes.statusRow} data-testid="subscription-status">
          <StatusBox title="Operação (acesso ao sistema)" info={op} />
          <StatusBox title="Financeiro (vencimento)" info={fin} extra={daysText(status)} />
          <StatusBox title="Assinatura" info={sub} />
        </Box>
        <Box className={classes.explanation}>
          <InfoOutlinedIcon fontSize="small" />
          <span>{STATUS_EXPLANATION}</span>
        </Box>

        <Box className={classes.grid}>
          <Cell
            label="Plano"
            value={data.plan?.name || "Sem plano"}
            hint={recurrenceLabel(data.recurrence, data.months)}
          />
          <Cell label="Valor contratado" value={formatBrl(data.contractedValue)} />
          <Cell label="Vencimento atual" value={formatDate(data.currentDueDate)} />
          <Cell
            label="Próximo ciclo"
            value={formatDate(data.nextCycleDueDate)}
            hint="Novo vencimento se a assinatura for renovada agora"
          />
          <Cell
            label="Último pagamento confirmado"
            value={last ? formatBrl(last.amount) : "Nenhum"}
            hint={
              last ? (
                <>
                  {formatPaidDate(last.paidAt, last.paidAtUnknown)}
                  {last.method ? ` · ${methodLabel(last.method)}` : ""}
                  {last.invoiceId ? ` · fatura #${last.invoiceId}` : ""}
                  <Box mt={0.5}>
                    <PaymentKindChip source={last.source} countsAsRevenue />
                  </Box>
                </>
              ) : (
                "Nenhum pagamento que conte como receita"
              )
            }
          />
          <Cell
            label="Próxima cobrança prevista"
            value={next ? formatBrl(next.value) : "Nenhuma"}
            hint={
              next
                ? `Fatura #${next.invoiceId} · vence ${formatDate(next.dueDate)}${
                    next.isHistoricalCandidate ? " · fatura antiga: revisar antes de cobrar" : ""
                  }`
                : "Sem fatura em aberto"
            }
          />
        </Box>

        <div className={classes.label}>Pendências</div>
        <Box className={classes.pendencies}>
          {hasPend ? null : (
            <Typography variant="body2" color="textSecondary">
              Nenhuma pendência.
            </Typography>
          )}
          {Number(pend.openInvoices) > 0 ? (
            <Button size="small" variant="outlined" className={classes.pendencyBtn} onClick={pendClick("open")}>
              {pend.openInvoices} {Number(pend.openInvoices) === 1 ? "fatura aberta" : "faturas abertas"} ·{" "}
              {formatBrl(pend.openAmount)}
            </Button>
          ) : null}
          {Number(pend.overdueInvoices) > 0 ? (
            <ToneChip
              tone="error"
              label={`${pend.overdueInvoices} ${Number(pend.overdueInvoices) === 1 ? "vencida" : "vencidas"}`}
            />
          ) : null}
          {Number(pend.reconciliationPending) > 0 ? (
            <Button size="small" variant="outlined" className={classes.pendencyBtn} onClick={pendClick("recon")}>
              {pend.reconciliationPending} na conciliação com a Efí
            </Button>
          ) : null}
          {Number(pend.historicalReviewPending) > 0 ? (
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              className={classes.pendencyBtn}
              onClick={pendClick("historical")}
            >
              {pend.historicalReviewPending}{" "}
              {Number(pend.historicalReviewPending) === 1
                ? "fatura antiga para revisar"
                : "faturas antigas para revisar"}
            </Button>
          ) : null}
        </Box>
      </>
    );
  }

  return (
    <Box className={classes.root} component="section" aria-label="Central de assinatura">
      <Box className={classes.head}>
        <Box>
          <Typography variant="subtitle1" component="h3" style={{ fontWeight: 700 }}>
            Central de assinatura
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Situação atual e próximos passos desta empresa.
          </Typography>
        </Box>
        {actions}
      </Box>
      {body}
    </Box>
  );
}
