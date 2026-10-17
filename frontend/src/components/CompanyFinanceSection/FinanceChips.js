import React from "react";
import { Chip, Tooltip } from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";

import { invoiceStatusLabel, paymentCategory, syncInfo } from "./financeFormat";

const useStyles = makeStyles((theme) => {
  const tone = (c) => ({
    backgroundColor: alpha(c, 0.14),
    color: theme.palette.type === "dark" ? theme.palette.getContrastText(c) : c,
    border: `1px solid ${alpha(c, 0.4)}`,
    fontWeight: 600,
    maxWidth: "100%",
  });
  return {
    success: tone(theme.palette.success.main),
    warning: tone(theme.palette.warning.dark),
    error: tone(theme.palette.error.main),
    info: tone(theme.palette.info.main),
    default: { maxWidth: "100%" },
    secondary: tone(theme.palette.secondary.main),
    historical: {
      ...tone(theme.palette.info.dark),
      borderStyle: "dashed",
    },
    label: { whiteSpace: "normal", lineHeight: 1.25, paddingTop: 2, paddingBottom: 2 },
    chipAuto: { height: "auto", minHeight: 24 },
  };
});

export function InvoiceStatusChip({ invoice }) {
  const classes = useStyles();
  const s = String(invoice?.status || "").toLowerCase();
  if (s === "open" && invoice?.isOverdue) {
    return <Chip size="small" label="Vencida" className={classes.error} />;
  }
  const cls =
    s === "paid" ? classes.success : s === "open" ? classes.warning : classes.default;
  return <Chip size="small" label={invoiceStatusLabel(s)} className={cls} />;
}

export function SyncStatusChip({ status }) {
  const classes = useStyles();
  const info = syncInfo(status);
  return (
    <Tooltip title={info.help} arrow>
      <Chip
        size="small"
        label={info.label}
        variant={info.tone === "default" ? "outlined" : "default"}
        className={`${classes[info.tone] || classes.default} ${classes.chipAuto}`}
        classes={{ label: classes.label }}
      />
    </Tooltip>
  );
}

export function LegacyChip() {
  const classes = useStyles();
  return (
    <Tooltip
      title="Fatura de antes da reorganização do faturamento: o ciclo/competência não pôde ser identificado com segurança. Revise individualmente antes de cobrar, registrar pagamento ou cancelar."
      arrow
    >
      <Chip size="small" label="Legado" variant="outlined" className={classes.info} />
    </Tooltip>
  );
}

/** Chip genérico com tom (success|warning|error|info|secondary|historical|default). */
export function ToneChip({ label, tone = "default", tooltip, variant, ...rest }) {
  const classes = useStyles();
  const chip = (
    <Chip
      size="small"
      label={label}
      variant={variant || (tone === "default" ? "outlined" : "default")}
      className={`${classes[tone] || classes.default} ${classes.chipAuto}`}
      classes={{ label: classes.label }}
      {...rest}
    />
  );
  return tooltip ? (
    <Tooltip title={tooltip} arrow>
      {chip}
    </Tooltip>
  ) : (
    chip
  );
}

const PAYMENT_CATEGORY_CHIP = {
  current: {
    label: "Pagamento atual",
    tone: "success",
    tooltip: "Dinheiro recebido e registrado no momento do pagamento. Conta como receita.",
  },
  historical: {
    label: "Pagamento histórico",
    tone: "historical",
    tooltip:
      "Regularização de fatura antiga: conta como receita, mas NÃO renovou a assinatura.",
  },
  courtesy: {
    label: "Cortesia",
    tone: "secondary",
    tooltip: "Fatura quitada sem recebimento de dinheiro. Não conta como receita.",
  },
  historical_courtesy: {
    label: "Cortesia histórica",
    tone: "secondary",
    tooltip: "Regularização de fatura antiga como cortesia: sem receita e sem renovação.",
  },
};

/** Diferencia visualmente pagamento atual, histórico e cortesias. */
export function PaymentKindChip({ source, countsAsRevenue }) {
  const info = PAYMENT_CATEGORY_CHIP[paymentCategory(source, countsAsRevenue)];
  return <ToneChip label={info.label} tone={info.tone} tooltip={info.tooltip} />;
}

/** Fatura antiga candidata à regularização histórica. */
export function HistoricalCandidateChip() {
  return (
    <ToneChip
      label="Histórica — revisar"
      tone="warning"
      tooltip="Fatura antiga sem pagamento registrado. Antes de cobrar ou registrar pagamento, revise se ela já foi paga, é indevida ou foi cortesia."
    />
  );
}
