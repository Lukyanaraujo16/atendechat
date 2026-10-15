import React, { useCallback, useEffect, useState } from "react";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Chip from "@material-ui/core/Chip";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  AppSectionCard,
  AppPrimaryButton,
  AppSecondaryButton,
  AppLoadingState,
} from "../../ui";

const useStyles = makeStyles((theme) => ({
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
    marginBottom: theme.spacing(1.5),
  },
  label: {
    fontWeight: 600,
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
    minWidth: 160,
  },
  hint: {
    marginTop: theme.spacing(1),
    color: theme.palette.text.secondary,
    fontSize: "0.8rem",
    lineHeight: 1.5,
  },
  warning: {
    marginBottom: theme.spacing(2),
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.warning.main}`,
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(255, 193, 7, 0.08)" : "#fff8e1",
  },
  testBox: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default,
  },
}));

function PresenceChip({ present }) {
  return (
    <Chip
      size="small"
      label={present ? "Presente no ambiente" : "Ausente"}
      color={present ? "primary" : "default"}
      variant={present ? "default" : "outlined"}
    />
  );
}

function FlagChip({ enabled }) {
  return (
    <Chip
      size="small"
      label={enabled ? "Flag habilitada" : "Flag desabilitada"}
      style={
        enabled
          ? { backgroundColor: "#e8f5e9", color: "#1b5e20" }
          : { backgroundColor: "#fafafa", color: "#616161" }
      }
    />
  );
}

/**
 * Diagnóstico Efí Pay (Super Admin).
 * Presença de env ≠ autenticação validada. OAuth só via “Testar conexão”.
 */
export default function EfiIntegrationPanel() {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/saas/finance/efi/status");
      setStatus(data);
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post("/saas/finance/efi/test-auth");
      setTestResult(data);
      if (data?.cobrancas?.ok) {
        toast.success("OAuth Cobranças validado");
      } else {
        toast.error(data?.cobrancas?.message || "Falha na autenticação OAuth");
      }
    } catch (e) {
      toastError(e);
      setTestResult({
        cobrancas: { ok: false, message: "Erro ao testar conexão" },
        pix: { available: false, tested: false },
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading && !status) {
    return (
      <AppSectionCard>
        <AppLoadingState />
      </AppSectionCard>
    );
  }

  if (!status) return null;

  const connectionChip = (() => {
    if (!testResult) {
      return (
        <Chip
          size="small"
          label="Autenticação não validada nesta sessão"
          variant="outlined"
        />
      );
    }
    if (testResult.cobrancas?.ok) {
      return (
        <Chip
          size="small"
          label="OAuth Cobranças validado"
          style={{ backgroundColor: "#e8f5e9", color: "#1b5e20" }}
        />
      );
    }
    return (
      <Chip
        size="small"
        label="Falha no OAuth Cobranças"
        style={{ backgroundColor: "#ffebee", color: "#b71c1c" }}
      />
    );
  })();

  const efiEnvLabel =
    status.environment === "sandbox"
      ? "Sandbox (Efí)"
      : "Produção (Efí)";

  const cobrancasPresence =
    status.credentials.cobrancasClientIdConfigured &&
    status.credentials.cobrancasClientSecretConfigured;

  return (
    <AppSectionCard>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        flexWrap="wrap"
        gridGap={12}
        marginBottom={2}
      >
        <Box>
          <Typography variant="h6">Integração Efí Pay</Typography>
          <Typography variant="body2" color="textSecondary">
            Diagnóstico da conta global da plataforma. Credenciais permanecem
            apenas em variáveis de ambiente — esta tela não edita secrets.
          </Typography>
        </Box>
        <Box display="flex" gridGap={8}>
          <AppSecondaryButton onClick={load} disabled={loading || testing}>
            Atualizar status
          </AppSecondaryButton>
          <AppPrimaryButton onClick={runTest} disabled={testing || loading}>
            {testing ? "Testando…" : "Testar OAuth Cobranças"}
          </AppPrimaryButton>
        </Box>
      </Box>

      <Box className={classes.warning}>
        <Typography variant="body2" style={{ fontWeight: 600 }}>
          Aviso sobre credenciais
        </Typography>
        <Typography variant="body2" style={{ marginTop: 4 }}>
          As credenciais exibidas podem ser provenientes de configurações
          herdadas do ambiente. Presença de valores não significa autenticação
          validada.
        </Typography>
      </Box>

      <Box className={classes.row}>
        <Typography className={classes.label}>Ambiente Efí</Typography>
        <Chip
          size="small"
          label={efiEnvLabel}
          color={status.environment === "sandbox" ? "default" : "secondary"}
        />
        <Typography variant="caption" color="textSecondary">
          (GERENCIANET_SANDBOX — independente do host StreamHUB)
        </Typography>
      </Box>

      <Box className={classes.row}>
        <Typography className={classes.label}>Autenticação</Typography>
        {connectionChip}
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" gutterBottom>
            Presença de variáveis (não valida login)
          </Typography>
          <Box className={classes.row}>
            <Typography className={classes.label}>Client ID (Pix)</Typography>
            <PresenceChip present={status.credentials.clientIdConfigured} />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>Client Secret (Pix)</Typography>
            <PresenceChip present={status.credentials.clientSecretConfigured} />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>Client ID Cobranças</Typography>
            <PresenceChip
              present={status.credentials.cobrancasClientIdConfigured}
            />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>
              Client Secret Cobranças
            </Typography>
            <PresenceChip
              present={status.credentials.cobrancasClientSecretConfigured}
            />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>Certificado P12</Typography>
            <Chip
              size="small"
              label={
                status.certificate.fileFound
                  ? "Arquivo encontrado"
                  : status.certificate.nameConfigured
                  ? "Nome configurado, arquivo ausente"
                  : "Não configurado"
              }
              color={status.certificate.fileFound ? "primary" : "default"}
              variant={status.certificate.fileFound ? "default" : "outlined"}
            />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>Chave Pix</Typography>
            <PresenceChip present={status.credentials.pixKeyConfigured} />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>Webhook secret</Typography>
            <PresenceChip
              present={status.credentials.webhookSecretConfigured}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" gutterBottom>
            Flags e prontidão (somente leitura)
          </Typography>
          <Box className={classes.row}>
            <Typography className={classes.label}>Pix</Typography>
            <FlagChip enabled={status.flags.pixEnabled} />
            <Chip
              size="small"
              variant="outlined"
              label={
                status.readiness.pix.ready
                  ? "Variáveis completas"
                  : "Variáveis incompletas"
              }
            />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>Boleto</Typography>
            <FlagChip enabled={status.flags.boletoEnabled} />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>Cartão</Typography>
            <FlagChip enabled={status.flags.cardEnabled} />
            <Chip size="small" variant="outlined" label="Não implementado" />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>Emissão automática</Typography>
            <FlagChip enabled={status.flags.autoInvoiceEnabled} />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>Conciliação (settle)</Typography>
            <FlagChip enabled={status.flags.cobrancasSettleEnabled} />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>API Cobranças</Typography>
            <Chip
              size="small"
              variant="outlined"
              label={
                cobrancasPresence
                  ? "Credenciais presentes (não validadas)"
                  : "Credenciais ausentes"
              }
            />
          </Box>
        </Grid>
      </Grid>

      {status.readiness.pix.missing?.length ? (
        <Typography className={classes.hint}>
          Pix — variáveis ausentes: {status.readiness.pix.missing.join(", ")}
        </Typography>
      ) : null}
      {status.readiness.cobrancas.missing?.length ? (
        <Typography className={classes.hint}>
          Cobranças — variáveis ausentes:{" "}
          {status.readiness.cobrancas.missing.join(", ")}
        </Typography>
      ) : null}

      {testResult ? (
        <Box className={classes.testBox}>
          <Typography variant="subtitle2" gutterBottom>
            Resultado do teste OAuth
          </Typography>
          <Typography variant="body2">
            Cobranças (OAuth):{" "}
            <strong>
              {testResult.cobrancas?.ok ? "Sucesso" : "Falha"}
            </strong>
            {testResult.cobrancas?.message
              ? ` — ${testResult.cobrancas.message}`
              : ""}
            {typeof testResult.cobrancas?.durationMs === "number"
              ? ` (${testResult.cobrancas.durationMs} ms)`
              : ""}
          </Typography>
          <Typography
            variant="body2"
            color="textSecondary"
            style={{ marginTop: 8 }}
          >
            Pix:{" "}
            {testResult.pix?.message ||
              "Teste isolado indisponível (sem geração de cobrança)."}
          </Typography>
        </Box>
      ) : (
        <Typography className={classes.hint}>
          O botão “Testar OAuth Cobranças” valida apenas autenticação na API
          Cobranças — não cria Pix, boleto nem fatura. Presença de variáveis
          acima não implica integração operacional.
        </Typography>
      )}
    </AppSectionCard>
  );
}
