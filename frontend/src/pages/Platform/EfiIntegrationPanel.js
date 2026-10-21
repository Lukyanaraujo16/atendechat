import React, { useCallback, useEffect, useState } from "react";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Chip from "@material-ui/core/Chip";
import TextField from "@material-ui/core/TextField";
import IconButton from "@material-ui/core/IconButton";
import InputAdornment from "@material-ui/core/InputAdornment";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import { makeStyles } from "@material-ui/core/styles";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  AppSectionCard,
  AppPrimaryButton,
  AppSecondaryButton,
  AppLoadingState,
} from "../../ui";
import EfiActivationStatusCard from "./EfiActivationStatusCard";
import EfiPixOperationsCard from "./EfiPixOperationsCard";
import EfiWebhookEventsCard from "./EfiWebhookEventsCard";
import EfiReconciliationQueueCard from "./EfiReconciliationQueueCard";

const useStyles = makeStyles((theme) => ({
  section: { marginBottom: theme.spacing(2) },
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
    marginBottom: theme.spacing(1),
  },
  label: {
    fontWeight: 600,
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
    minWidth: 140,
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
  field: { marginBottom: theme.spacing(1.5) },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
}));

const DIAG_LABELS = {
  runtime_invalid: "Runtime inválido",
  empty: "Não configurado",
  incomplete: "Incompleto",
  configured: "Configurado (não validado)",
  auth_validated: "Autenticação Cobranças validada",
  admin_enabled_awaiting_pix: "Habilitado — aguardando homologação Pix",
  pix_operational: "Pix operacional",
  revoked: "Revogado",
};

const emptyForm = () => ({
  clientId: "",
  clientSecret: "",
  pixKey: "",
  webhookSecret: "",
});

/**
 * Gestão administrativa Efí Pay (8.3-B2).
 * Credenciais no banco; checkout legado permanece em env até B3.
 */
export default function EfiIntegrationPanel() {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState(null);
  const [audits, setAudits] = useState([]);
  const [testResult, setTestResult] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [show, setShow] = useState({
    clientId: false,
    clientSecret: false,
    pixKey: false,
    webhookSecret: false,
  });
  const [certFile, setCertFile] = useState(null);

  const slot = config?.allowedSlot || config?.slot || "homologation";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, audRes] = await Promise.all([
        api.get("/saas/finance/efi/config"),
        api.get("/saas/finance/efi/config/audits").catch(() => ({ data: { items: [] } })),
      ]);
      setConfig(cfgRes.data);
      setAudits(audRes.data?.items || []);
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const clearSensitiveForm = () => {
    setForm(emptyForm());
    setCertFile(null);
    setShow({
      clientId: false,
      clientSecret: false,
      pixKey: false,
      webhookSecret: false,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {};
      if (form.clientId.trim()) body.clientId = form.clientId.trim();
      if (form.clientSecret.trim()) body.clientSecret = form.clientSecret.trim();
      if (form.pixKey.trim()) body.pixKey = form.pixKey.trim();
      if (form.webhookSecret.trim()) body.webhookSecret = form.webhookSecret.trim();

      const { data } = await api.put(`/saas/finance/efi/config/${slot}`, body);
      setConfig(data);
      clearSensitiveForm();
      toast.success("Credenciais salvas (campos vazios preservam valores existentes).");
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadCert = async () => {
    if (!certFile) {
      toast.error("Selecione um arquivo .p12 ou .pfx");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("certificate", certFile);
      const { data } = await api.post(
        `/saas/finance/efi/config/${slot}/certificate`,
        fd
      );
      setConfig(data);
      setCertFile(null);
      toast.success("Certificado armazenado com segurança.");
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCert = async () => {
    if (!window.confirm("Remover o certificado P12 cadastrado?")) return;
    setSaving(true);
    try {
      const { data } = await api.delete(
        `/saas/finance/efi/config/${slot}/certificate`
      );
      setConfig(data);
      toast.success("Certificado removido.");
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post(
        `/saas/finance/efi/config/${slot}/test-auth`
      );
      setTestResult(data);
      if (data?.config) setConfig(data.config);
      if (data?.cobrancas?.ok) {
        toast.success(
          data?.pix?.ok
            ? "OAuth Cobranças validado; Pix validado (mTLS)."
            : `OAuth Cobranças validado; Pix não validado: ${
                data?.pix?.message || "sem detalhe"
              }`
        );
      } else {
        toast.error(data?.cobrancas?.message || "Falha no OAuth");
      }
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setTesting(false);
    }
  };

  const handleActivate = async () => {
    if (
      !window.confirm(
        "Ativar administrativamente esta configuração?\n\nIsso NÃO altera o checkout Pix legado nem cria cobranças. O cutover ocorre na fase 8.3-B3."
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post(
        `/saas/finance/efi/config/${slot}/activate`,
        { confirm: true }
      );
      setConfig(data);
      toast.success("Configuração habilitada administrativamente.");
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm("Desativar a habilitação administrativa?")) return;
    setSaving(true);
    try {
      const { data } = await api.post(
        `/saas/finance/efi/config/${slot}/deactivate`
      );
      setConfig(data);
      toast.success("Desativado.");
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (
      !window.confirm(
        "REVOGAR todas as credenciais deste slot?\nEsta ação remove secrets e certificado do banco."
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post(
        `/saas/finance/efi/config/${slot}/revoke`,
        { confirm: true }
      );
      setConfig(data);
      clearSensitiveForm();
      toast.success("Credenciais revogadas.");
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const secretField = (key, label, configured) => (
    <TextField
      className={classes.field}
      fullWidth
      variant="outlined"
      size="small"
      type={show[key] ? "text" : "password"}
      autoComplete="new-password"
      label={label}
      placeholder={configured ? "•••• cadastrado — deixe vazio para preservar" : ""}
      helperText={
        configured
          ? `Cadastrado${
              key === "clientId" && config?.credentials?.clientIdMasked
                ? `: ${config.credentials.clientIdMasked}`
                : key === "pixKey" && config?.credentials?.pixKeyMasked
                ? `: ${config.credentials.pixKeyMasked}`
                : ""
            }. Envie vazio para manter.`
          : "Não cadastrado"
      }
      value={form[key]}
      onChange={(e) => setField(key, e.target.value)}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              size="small"
              onClick={() =>
                setShow((s) => ({ ...s, [key]: !s[key] }))
              }
              tabIndex={-1}
            >
              {show[key] ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );

  if (loading && !config) {
    return (
      <AppSectionCard>
        <AppLoadingState />
      </AppSectionCard>
    );
  }

  if (!config) return null;

  const diag =
    DIAG_LABELS[config.diagnosticState] || config.diagnosticState || "—";

  return (
    <>
      <AppSectionCard className={classes.section}>
        <Typography variant="h6">Integração Efí Pay</Typography>
        <Typography variant="body2" color="textSecondary">
          Conta recebedora global da plataforma (assinaturas SaaS). Credenciais
          no banco cifrado — o checkout Pix atual ainda usa variáveis de
          ambiente até a fase 8.3-B3.
        </Typography>

        <Box className={classes.warning} mt={2}>
          <Typography variant="body2" style={{ fontWeight: 600 }}>
            Aviso
          </Typography>
          <Typography variant="body2" style={{ marginTop: 4 }}>
            As credenciais exibidas como “cadastrado” são máscaras. Presença não
            significa autenticação validada. OAuth Cobranças não valida Pix.
            Ativação administrativa não altera cobranças em produção/teste
            legado.
          </Typography>
        </Box>

        <Typography variant="subtitle2" gutterBottom>
          Ambiente
        </Typography>
        <Box className={classes.row}>
          <Typography className={classes.label}>StreamHUB</Typography>
          <Chip
            size="small"
            label={`Ambiente StreamHUB: ${config.runtime?.label || "—"}`}
            color={config.runtime?.valid ? "primary" : "default"}
          />
        </Box>
        <Box className={classes.row}>
          <Typography className={classes.label}>Efí</Typography>
          <Chip
            size="small"
            label={`Ambiente Efí: ${config.efiEnvironmentLabel || "—"}`}
          />
          <Chip size="small" variant="outlined" label={`Slot: ${slot}`} />
        </Box>
        <Box className={classes.row}>
          <Typography className={classes.label}>Estado</Typography>
          <Chip size="small" label={diag} />
          {config.adminEnabled ? (
            <Chip size="small" label="Admin habilitado" color="primary" />
          ) : null}
          <Chip
            size="small"
            variant="outlined"
            label={
              config.pixOperational
                ? "Pix operacional"
                : "Pix não operacional"
            }
          />
        </Box>
      </AppSectionCard>

      <AppSectionCard className={classes.section}>
        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
          Credenciais
        </Typography>
        <Typography className={classes.hint} component="p">
          Campos vazios preservam o valor já cadastrado. Client ID e secrets são
          criptografados; nunca reenviados ao navegador.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            {secretField(
              "clientId",
              "Client ID",
              config.credentials?.clientIdConfigured
            )}
            {secretField(
              "clientSecret",
              "Client Secret",
              config.credentials?.clientSecretConfigured
            )}
          </Grid>
          <Grid item xs={12} md={6}>
            {secretField(
              "pixKey",
              "Chave Pix",
              config.credentials?.pixKeyConfigured
            )}
            {secretField(
              "webhookSecret",
              "Webhook secret (interno)",
              config.credentials?.webhookSecretConfigured
            )}
          </Grid>
        </Grid>
        <Box className={classes.actions}>
          <AppPrimaryButton onClick={handleSave} loading={saving} disabled={testing}>
            Salvar credenciais
          </AppPrimaryButton>
        </Box>
      </AppSectionCard>

      <AppSectionCard className={classes.section}>
        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
          Certificado P12
        </Typography>
        <Box className={classes.row}>
          <Chip
            size="small"
            label={
              config.certificate?.configured
                ? "Certificado cadastrado"
                : "Sem certificado"
            }
            color={config.certificate?.configured ? "primary" : "default"}
          />
          {config.certificate?.friendlyName ? (
            <Typography variant="caption">
              {config.certificate.friendlyName}
            </Typography>
          ) : null}
        </Box>
        {config.certificate?.fingerprint ? (
          <Typography variant="caption" color="textSecondary" component="p">
            Fingerprint SHA-256: {config.certificate.fingerprint}
            {config.certificate.uploadedAt
              ? ` · ${new Date(config.certificate.uploadedAt).toLocaleString()}`
              : ""}
          </Typography>
        ) : null}
        <Box mt={1}>
          <input
            type="file"
            accept=".p12,.pfx"
            onChange={(e) => setCertFile(e.target.files?.[0] || null)}
          />
        </Box>
        <Box className={classes.actions}>
          <AppPrimaryButton
            onClick={handleUploadCert}
            loading={saving}
            disabled={!certFile}
          >
            Enviar certificado
          </AppPrimaryButton>
          <AppSecondaryButton
            onClick={handleDeleteCert}
            disabled={!config.certificate?.configured || saving}
          >
            Remover certificado
          </AppSecondaryButton>
        </Box>
      </AppSectionCard>

      <AppSectionCard className={classes.section}>
        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
          Webhook
        </Typography>
        <Typography className={classes.hint} component="p">
          {config.webhook?.note}
        </Typography>
        <Box className={classes.row}>
          <Chip
            size="small"
            label={
              config.webhook?.secretConfigured
                ? "Secret interno cadastrado"
                : "Secret interno ausente"
            }
          />
          <Chip
            size="small"
            variant="outlined"
            label={`Callback: ${config.webhook?.callbackPath || "/subscription/webhook"}`}
          />
          <Chip
            size="small"
            variant="outlined"
            label="Registro na Efí: pendente (B3)"
          />
        </Box>
      </AppSectionCard>

      <AppSectionCard className={classes.section}>
        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
          Diagnóstico e ações
        </Typography>
        <Box className={classes.actions}>
          <AppSecondaryButton onClick={load} disabled={loading || testing}>
            Atualizar
          </AppSecondaryButton>
          <AppPrimaryButton onClick={handleTest} disabled={testing || saving}>
            {testing ? "Testando…" : "Testar OAuth Cobranças"}
          </AppPrimaryButton>
          <AppPrimaryButton
            onClick={handleActivate}
            disabled={saving || config.adminEnabled}
          >
            Ativar (admin)
          </AppPrimaryButton>
          <AppSecondaryButton
            onClick={handleDeactivate}
            disabled={saving || !config.adminEnabled}
          >
            Desativar
          </AppSecondaryButton>
          <AppSecondaryButton onClick={handleRevoke} disabled={saving}>
            Revogar
          </AppSecondaryButton>
        </Box>

        {config.lastAuthTest?.at ? (
          <Typography className={classes.hint} component="p">
            Último OAuth:{" "}
            {config.lastAuthTest.ok ? "sucesso" : "falha"}
            {config.lastAuthTest.message
              ? ` — ${config.lastAuthTest.message}`
              : ""}{" "}
            ({new Date(config.lastAuthTest.at).toLocaleString()}). Pix validado:
            não.
          </Typography>
        ) : (
          <Typography className={classes.hint} component="p">
            OAuth ainda não testado com as credenciais do banco.
          </Typography>
        )}

        {testResult ? (
          <Box mt={1}>
            <Typography variant="body2">
              Cobranças:{" "}
              <strong>
                {testResult.cobrancas?.ok ? "Sucesso" : "Falha"}
              </strong>
              {testResult.cobrancas?.message
                ? ` — ${testResult.cobrancas.message}`
                : ""}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Pix: {testResult.pix?.message || "não validado"}
            </Typography>
          </Box>
        ) : null}
      </AppSectionCard>

      <EfiActivationStatusCard />

      <EfiPixOperationsCard />

      <EfiWebhookEventsCard slot={slot} />

      <EfiReconciliationQueueCard />

      <AppSectionCard>
        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
          Histórico administrativo
        </Typography>
        {audits.length === 0 ? (
          <Typography className={classes.hint}>Nenhum evento ainda.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Ação</TableCell>
                <TableCell>Admin</TableCell>
                <TableCell>Resumo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {audits.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    {a.createdAt
                      ? new Date(a.createdAt).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell>{a.action}</TableCell>
                  <TableCell>{a.actorUserId ?? "—"}</TableCell>
                  <TableCell>
                    <Typography variant="caption" component="span">
                      {a.diffSummary
                        ? JSON.stringify(a.diffSummary)
                        : "—"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AppSectionCard>
    </>
  );
}
