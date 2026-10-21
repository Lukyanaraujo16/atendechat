import React, { useCallback, useEffect, useState } from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import { makeStyles } from "@material-ui/core/styles";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AppSectionCard, AppSecondaryButton } from "../../ui";

const useStyles = makeStyles((theme) => ({
  warnRow: {
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(255, 193, 7, 0.08)" : "#fff8e1",
  },
  warnText: { color: theme.palette.warning.dark, fontWeight: 600 },
  label: { fontWeight: 600 },
}));

const yesNo = (v) => (v ? "sim" : "não");
const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");
const short = (v) => (v ? String(v).slice(0, 12) : "—");

/**
 * Fase 8.3-B3 — controles de ativação (env) × liberação no código × efeito real,
 * versão em execução e prontidão da fonte `database`. Só Super Admin; o DTO não tem segredos.
 */
export default function EfiActivationStatusCard() {
  const classes = useStyles();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

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

  const controls = status?.controls || {};
  const pix = status?.pixChargeV2 || {};
  const pipe = status?.webhookPipeline || {};
  const sweep = pipe.sweep || {};
  const cred = status?.credentialsSource || {};
  const db = cred.database || {};
  const version = status?.version || {};

  // on = valor da env pede ativação; released undefined = controle sem conceito de liberação
  const rows = [
    {
      key: "credentialsSource",
      label: "Fonte de credenciais",
      configured: controls.credentialsSource || "—",
      on: controls.credentialsSource === "database",
      released: cred.databaseFinancialReleased,
      runtimes: cred.databaseFinancialReleasedRuntimes,
      effective: `financeiro usa: ${cred.financial || "—"}`,
    },
    {
      key: "pixChargeV2",
      label: "Cobrança Pix v2",
      configured: yesNo(pix.configured),
      on: !!pix.configured,
      released: pix.released,
      runtimes: pix.releasedRuntimes,
      effective: pix.active ? "ativo" : "inativo",
    },
    {
      key: "webhookPipeline",
      label: "Pipeline do webhook",
      configured: pipe.configured || "—",
      on: pipe.configured === "async",
      released: pipe.released,
      runtimes: pipe.releasedRuntimes,
      effective: pipe.active ? "ativo" : "inativo",
    },
    {
      key: "workerPaused",
      label: "Pausa do worker",
      configured: yesNo(controls.webhookWorkerPaused),
      on: false,
      released: undefined,
      effective: pipe.workerPaused ? "pausado" : "rodando",
    },
    {
      key: "sweep",
      label: "Varredura Pix",
      configured: yesNo(sweep.configured),
      on: !!sweep.configured,
      released: sweep.released,
      runtimes: sweep.releasedRuntimes,
      effective: sweep.active ? "ativo" : "inativo",
    },
    {
      key: "trustProxyHops",
      label: "TRUST_PROXY_HOPS",
      configured:
        controls.trustProxyHops === undefined || controls.trustProxyHops === null
          ? "—"
          : String(controls.trustProxyHops),
      on: false,
      released: undefined,
      effective: "—",
    },
  ];

  const invalid = controls.invalid || [];
  const missing = db.missing || [];
  const homolog = db.homologation || {};

  return (
    <AppSectionCard>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
          Status da integração e controles
        </Typography>
        <AppSecondaryButton onClick={load} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </AppSecondaryButton>
      </Box>

      {status ? (
        <>
          <Typography variant="body2" color="textSecondary">
            Ambiente: {status.environment === "production" ? "produção" : "sandbox"} ·
            Pix pronto: {yesNo(status.readiness?.pix?.ready)} · Cobranças prontas:{" "}
            {yesNo(status.readiness?.cobrancas?.ready)}
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Controle</TableCell>
                <TableCell>Valor configurado (env)</TableCell>
                <TableCell>Liberado no código (este runtime)</TableCell>
                <TableCell>Efetivo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => {
                const blocked = r.on && r.released === false;
                return (
                  <TableRow key={r.key} className={blocked ? classes.warnRow : undefined}>
                    <TableCell>{r.label}</TableCell>
                    <TableCell>{r.configured}</TableCell>
                    <TableCell>
                      {r.released === undefined
                        ? "—"
                        : `${yesNo(r.released)} (runtimes: ${
                            (r.runtimes || []).join(", ") || "nenhum"
                          })`}
                      {blocked ? (
                        <Typography variant="caption" component="p" className={classes.warnText}>
                          Configurado mas não liberado: a env sozinha não ativa.
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>{r.effective}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {invalid.length ? (
            <Typography variant="body2" className={classes.warnText}>
              Controles com valor inválido (padrão seguro aplicado): {invalid.join(", ")}
            </Typography>
          ) : null}

          <Box mt={1}>
            <Typography variant="body2">
              <span className={classes.label}>Versão:</span>{" "}
              {version.currentCommit ? short(version.currentCommit) : "desconhecida"}
              {version.source ? ` · origem ${version.source}` : ""}
              {version.builtAt ? ` · build ${fmtDate(version.builtAt)}` : ""}
            </Typography>
            {version.dirty === true ? (
              <Typography variant="caption" component="p" className={classes.warnText}>
                Build com alterações locais.
              </Typography>
            ) : null}
          </Box>

          <Box mt={1}>
            <Typography variant="body2" className={classes.label}>
              Fonte database
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Slot: {db.slot || "—"} · Ambiente: {db.efiEnvironment || "—"} · Config
              encontrada: {yesNo(db.configFound)} · Válida: {yesNo(db.validConfig)}
              {missing.length ? ` · Faltando: ${missing.join(", ")}` : ""}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Fingerprint: {short(db.configFingerprint)} · Validação Pix:{" "}
              {db.pixValidation?.validated
                ? `sim (${fmtDate(db.pixValidation.at)})`
                : "não"}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Homologação{homolog.required ? " (exigida)" : ""}:{" "}
              {homolog.homologated
                ? `sim em ${fmtDate(homolog.at)} · commit ${short(homolog.commit)}`
                : "não"}
            </Typography>
            {homolog.versionDiffers === true ? (
              <Typography variant="caption" component="p" className={classes.warnText}>
                Versão atual difere da homologada.
              </Typography>
            ) : null}
            <Typography variant="body2" color="textSecondary">
              Utilizável agora: {yesNo(db.usable)}
              {db.blockedReason ? ` · Bloqueio: ${db.blockedReason}` : ""}
            </Typography>
          </Box>
        </>
      ) : null}
    </AppSectionCard>
  );
}
