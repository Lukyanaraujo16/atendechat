import React, { useCallback, useEffect, useState } from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Chip from "@material-ui/core/Chip";
import { makeStyles } from "@material-ui/core/styles";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AppSectionCard, AppLoadingState, AppSecondaryButton } from "../../ui";

const useStyles = makeStyles((theme) => ({
  row: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    "&:last-child": { borderBottom: "none" },
  },
  label: {
    fontWeight: 600,
    minWidth: 180,
    flex: "0 0 180px",
  },
  hint: {
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(1.5),
    lineHeight: 1.5,
  },
}));

/**
 * Estado operacional somente leitura — sem toggles.
 * Fonte: GET /saas/finance/efi/status (flags + readiness).
 */
function methodState({ enabled, ready, notImplemented }) {
  if (notImplemented) {
    return {
      label: "Não implementado",
      style: { backgroundColor: "#fafafa", color: "#616161" },
    };
  }
  if (!enabled) {
    return {
      label: "Desabilitado",
      style: { backgroundColor: "#fafafa", color: "#616161" },
    };
  }
  if (ready) {
    return {
      label: "Disponível",
      style: { backgroundColor: "#e8f5e9", color: "#1b5e20" },
    };
  }
  return {
    label: "Aguardando configuração",
    style: { backgroundColor: "#fff8e1", color: "#f57f17" },
  };
}

export default function PaymentMethodsReadonlyPanel() {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/saas/finance/efi/status");
      setStatus(data);
    } catch (e) {
      toastError(e);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !status) {
    return (
      <AppSectionCard>
        <AppLoadingState />
      </AppSectionCard>
    );
  }

  if (!status) {
    return (
      <AppSectionCard>
        <Typography color="textSecondary">
          Não foi possível carregar o estado dos métodos de pagamento.
        </Typography>
        <Box mt={1}>
          <AppSecondaryButton onClick={load}>Tentar novamente</AppSecondaryButton>
        </Box>
      </AppSectionCard>
    );
  }

  const flags = status.flags || {};
  const readiness = status.readiness || {};

  const rows = [
    {
      key: "pix",
      title: "Pix",
      detail:
        "Checkout do cliente via API Pix (credenciais do banco quando a fonte database está ativa; senão variáveis de ambiente).",
      state: methodState({
        enabled: flags.pixEnabled,
        ready: readiness.pix?.ready,
      }),
    },
    {
      key: "boleto",
      title: "Boleto",
      detail: "API Cobranças — emissão desligada por flag até homologação.",
      state: methodState({
        enabled: flags.boletoEnabled,
        ready: readiness.cobrancas?.ready && flags.boletoEnabled,
      }),
    },
    {
      key: "card",
      title: "Cartão",
      detail: "Cartão de crédito não está implementado nesta versão.",
      state: methodState({ notImplemented: true }),
    },
    {
      key: "autoInvoice",
      title: "Emissão automática",
      detail: "Geração de faturas por job (SAAS_BILLING_AUTO_INVOICE).",
      state: methodState({
        enabled: flags.autoInvoiceEnabled,
        ready: flags.autoInvoiceEnabled,
      }),
    },
    {
      key: "autoRenew",
      title: "Renovação automática",
      detail: "Estende vencimento após pagamento confirmado (idempotente).",
      state: methodState({
        enabled: flags.autoRenewOnPayment,
        ready: flags.autoRenewOnPayment,
      }),
    },
    {
      key: "settle",
      title: "Conciliação (settle Efí)",
      detail: "Baixa manual na API Cobranças — desligada por flag.",
      state: methodState({
        enabled: flags.cobrancasSettleEnabled,
        ready: flags.cobrancasSettleEnabled && readiness.cobrancas?.ready,
      }),
    },
  ];

  return (
    <AppSectionCard>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gridGap={8}>
        <Box>
          <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
            Métodos de pagamento
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Visualização somente leitura do estado atual. Não é possível
            habilitar funcionalidades incompletas nesta tela.
          </Typography>
        </Box>
        <AppSecondaryButton onClick={load} disabled={loading}>
          Atualizar
        </AppSecondaryButton>
      </Box>

      <Box mt={2}>
        {rows.map((row) => (
          <Box key={row.key} className={classes.row}>
            <Typography className={classes.label}>{row.title}</Typography>
            <Chip size="small" label={row.state.label} style={row.state.style} />
            <Typography variant="caption" color="textSecondary">
              {row.detail}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography className={classes.hint} component="p">
        Alteração de flags e credenciais permanece via variáveis de ambiente do
        servidor (homologação). Consulte a guia Integração Efí Pay para
        diagnóstico.
      </Typography>
    </AppSectionCard>
  );
}
