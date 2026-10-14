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
  },
  testBox: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default,
  },
}));

function StatusChip({ ok, yesLabel, noLabel }) {
  return (
    <Chip
      size="small"
      label={ok ? yesLabel : noLabel}
      color={ok ? "primary" : "default"}
      variant={ok ? "default" : "outlined"}
    />
  );
}

function FlagChip({ enabled }) {
  return (
    <Chip
      size="small"
      label={enabled ? "Habilitado" : "Desabilitado"}
      style={
        enabled
          ? { backgroundColor: "#e8f5e9", color: "#1b5e20" }
          : { backgroundColor: "#fafafa", color: "#616161" }
      }
    />
  );
}

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
        toast.success("Conexão Cobranças validada");
      } else {
        toast.error(data?.cobrancas?.message || "Falha na autenticação");
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
      return <Chip size="small" label="Conexão não testada" variant="outlined" />;
    }
    if (testResult.cobrancas?.ok) {
      return (
        <Chip
          size="small"
          label="Conexão validada"
          style={{ backgroundColor: "#e8f5e9", color: "#1b5e20" }}
        />
      );
    }
    return (
      <Chip
        size="small"
        label="Erro de autenticação"
        style={{ backgroundColor: "#ffebee", color: "#b71c1c" }}
      />
    );
  })();

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
            Diagnóstico da conta global da plataforma. Credenciais continuam
            apenas em variáveis de ambiente — esta tela não edita secrets.
          </Typography>
        </Box>
        <Box display="flex" gridGap={8}>
          <AppSecondaryButton onClick={load} disabled={loading || testing}>
            Atualizar status
          </AppSecondaryButton>
          <AppPrimaryButton onClick={runTest} disabled={testing || loading}>
            {testing ? "Testando…" : "Testar conexão"}
          </AppPrimaryButton>
        </Box>
      </Box>

      <Box className={classes.row}>
        <Typography className={classes.label}>Ambiente</Typography>
        <Chip
          size="small"
          label={status.environment === "sandbox" ? "Sandbox" : "Produção"}
          color={status.environment === "sandbox" ? "default" : "secondary"}
        />
        {connectionChip}
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" gutterBottom>
            Credenciais
          </Typography>
          <Box className={classes.row}>
            <Typography className={classes.label}>Client ID</Typography>
            <StatusChip
              ok={status.credentials.clientIdConfigured}
              yesLabel="Configurado"
              noLabel="Não configurado"
            />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>Client Secret</Typography>
            <StatusChip
              ok={status.credentials.clientSecretConfigured}
              yesLabel="Configurado"
              noLabel="Não configurado"
            />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>Certificado P12</Typography>
            <StatusChip
              ok={status.certificate.fileFound}
              yesLabel="Encontrado"
              noLabel={
                status.certificate.nameConfigured
                  ? "Não encontrado"
                  : "Não configurado"
              }
            />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>Chave Pix</Typography>
            <StatusChip
              ok={status.credentials.pixKeyConfigured}
              yesLabel="Configurado"
              noLabel="Não configurado"
            />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>Webhook secret</Typography>
            <StatusChip
              ok={status.credentials.webhookSecretConfigured}
              yesLabel="Configurado"
              noLabel="Não configurado"
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" gutterBottom>
            Funcionalidades
          </Typography>
          <Box className={classes.row}>
            <Typography className={classes.label}>Pix</Typography>
            <FlagChip enabled={status.flags.pixEnabled} />
            <StatusChip
              ok={status.readiness.pix.ready}
              yesLabel="Pronto"
              noLabel="Incompleto"
            />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>Boleto</Typography>
            <FlagChip enabled={status.flags.boletoEnabled} />
          </Box>
          <Box className={classes.row}>
            <Typography className={classes.label}>Cartão</Typography>
            <FlagChip enabled={status.flags.cardEnabled} />
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
            <StatusChip
              ok={status.readiness.cobrancas.ready}
              yesLabel="Credenciais OK"
              noLabel="Incompleto"
            />
          </Box>
        </Grid>
      </Grid>

      {status.readiness.pix.missing?.length ? (
        <Typography className={classes.hint}>
          Pix incompleto: {status.readiness.pix.missing.join(", ")}
        </Typography>
      ) : null}
      {status.readiness.cobrancas.missing?.length ? (
        <Typography className={classes.hint}>
          Cobranças incompleto: {status.readiness.cobrancas.missing.join(", ")}
        </Typography>
      ) : null}

      {testResult ? (
        <Box className={classes.testBox}>
          <Typography variant="subtitle2" gutterBottom>
            Resultado do teste
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
          <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
            Pix:{" "}
            {testResult.pix?.message ||
              "Teste isolado indisponível (sem geração de cobrança)."}
          </Typography>
        </Box>
      ) : (
        <Typography className={classes.hint}>
          O botão “Testar conexão” valida apenas OAuth da API Cobranças — não
          cria Pix, boleto nem fatura.
        </Typography>
      )}
    </AppSectionCard>
  );
}
