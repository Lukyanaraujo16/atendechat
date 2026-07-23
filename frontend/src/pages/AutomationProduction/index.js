import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import toastError from "../../errors/toastError";
import {
  getProductionDashboard,
  runRolloutPreflight,
  transitionRollout,
  suspendRollout,
  rollbackRollout,
  emergencyStop,
  checkReleaseReadiness,
  getEvidencePackage,
  setKillSwitch,
} from "../../services/automationProductionApi";

const useStyles = makeStyles((theme) => ({
  paper: { padding: theme.spacing(2), marginBottom: theme.spacing(2) },
  chip: { marginRight: theme.spacing(1), marginBottom: theme.spacing(1) },
  mono: { fontFamily: "monospace", fontSize: 12 },
  warn: { color: theme.palette.error.main },
}));

const AutomationProduction = () => {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState(null);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getProductionDashboard();
      setDash(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const withReason = async (fn) => {
    if (!reason || reason.trim().length < 3) {
      toast.error("Informe um motivo (mín. 3 caracteres)");
      return;
    }
    try {
      await fn(reason.trim());
      toast.success("Operação concluída");
      setConfirmOpen(null);
      setReason("");
      load();
    } catch (err) {
      toastError(err);
    }
  };

  const onPreflight = async () => {
    try {
      const { data } = await runRolloutPreflight();
      toast.info(`Preflight: ${data.status}`);
      load();
    } catch (err) {
      toastError(err);
    }
  };

  const onReadiness = async () => {
    try {
      const { data } = await checkReleaseReadiness();
      toast.info(`Readiness: ${data.status}`);
      load();
    } catch (err) {
      toastError(err);
    }
  };

  const onEvidence = async () => {
    try {
      const { data } = await getEvidencePackage();
      const blob = new Blob([data.markdown || JSON.stringify(data.json, null, 2)], {
        type: "text/markdown",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "agentos-rc-evidence.md";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toastError(err);
    }
  };

  const version = dash?.readiness?.version;
  const rollout = dash?.rollout;

  return (
    <MainContainer>
      <MainHeader>
        <Title>AgentOS Production / Release Candidate</Title>
        <Box>
          <Button variant="outlined" color="primary" onClick={load} style={{ marginRight: 8 }}>
            Atualizar
          </Button>
          <Button variant="outlined" onClick={onPreflight} style={{ marginRight: 8 }}>
            Preflight
          </Button>
          <Button variant="outlined" onClick={onReadiness} style={{ marginRight: 8 }}>
            Readiness
          </Button>
          <Button variant="contained" color="primary" onClick={onEvidence}>
            Evidence
          </Button>
        </Box>
      </MainHeader>

      {loading && !dash ? (
        <Paper className={classes.paper}>
          <Table>
            <TableBody>
              <TableRowSkeleton columns={4} />
            </TableBody>
          </Table>
        </Paper>
      ) : (
        <>
          <Paper className={classes.paper}>
            <Typography variant="h6" gutterBottom>
              Defaults de segurança (sempre OFF por padrão)
            </Typography>
            <Chip className={classes.chip} label={`live=${String(dash?.defaults?.liveEnabled)}`} />
            <Chip className={classes.chip} label={`toolWrite=${String(dash?.defaults?.toolWriteEnabled)}`} />
            <Chip className={classes.chip} label={`mcpWrite=${String(dash?.defaults?.mcpWriteEnabled)}`} />
            <Chip className={classes.chip} label={`autoRollback=${String(dash?.defaults?.autoRollbackEnabled)}`} />
            <Chip className={classes.chip} label={`coordinatorLive=${String(dash?.defaults?.coordinatorLiveEnabled)}`} />
            <Typography variant="body2" color="textSecondary" className={classes.mono}>
              {version?.agentOsVersion} · schema {version?.schemaVersion} · build{" "}
              {version?.buildVersion}
            </Typography>
          </Paper>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper className={classes.paper}>
                <Typography variant="h6">Rollout</Typography>
                <Chip
                  className={classes.chip}
                  color="primary"
                  label={rollout?.rolloutState || "DISABLED"}
                />
                <Typography variant="body2">
                  version={rollout?.version} · previous={rollout?.previousRolloutState || "-"}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Transições: {(dash?.transitionsAllowed || []).join(", ") || "—"}
                </Typography>
                <Box mt={2}>
                  <Button
                    size="small"
                    variant="outlined"
                    style={{ marginRight: 8 }}
                    onClick={() => setConfirmOpen("INTERNAL_ONLY")}
                  >
                    → INTERNAL_ONLY
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    style={{ marginRight: 8 }}
                    onClick={() => setConfirmOpen("SHADOW")}
                  >
                    → SHADOW
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="secondary"
                    style={{ marginRight: 8 }}
                    onClick={() => setConfirmOpen("suspend")}
                  >
                    Suspender
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="secondary"
                    onClick={() => setConfirmOpen("rollback")}
                  >
                    Rollback
                  </Button>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper className={classes.paper}>
                <Typography variant="h6">Release readiness</Typography>
                <Chip
                  className={classes.chip}
                  color={dash?.readiness?.status === "READY" ? "primary" : "default"}
                  label={dash?.readiness?.status || "—"}
                />
                <Typography variant="body2">
                  blockers: {(dash?.readiness?.blockers || []).length} · warnings:{" "}
                  {(dash?.readiness?.warnings || []).length}
                </Typography>
                <Typography variant="h6" style={{ marginTop: 16 }}>
                  Canary
                </Typography>
                <Chip className={classes.chip} label={dash?.canary?.health || "—"} />
                <Typography variant="body2" className={classes.mono}>
                  {(dash?.canary?.reasonCodes || []).join(", ") || "sem códigos"}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Paper className={classes.paper}>
            <Typography variant="h6">Capability gates</Typography>
            <Chip
              className={classes.chip}
              label={`live: ${dash?.gates?.live?.allowed ? "ALLOW" : "DENY"} (${dash?.gates?.live?.reasonCode})`}
            />
            <Chip
              className={classes.chip}
              label={`toolWrite: ${dash?.gates?.toolWrite?.allowed ? "ALLOW" : "DENY"}`}
            />
            <Chip
              className={classes.chip}
              label={`mcpWrite: ${dash?.gates?.mcpWrite?.allowed ? "ALLOW" : "DENY"}`}
            />
          </Paper>

          <Paper className={classes.paper}>
            <Typography variant="h6">Kill switches / Emergency</Typography>
            <Typography variant="body2">
              global: {(dash?.killSwitches?.global || []).filter((e) => e.enabled).length} ·
              tenant: {(dash?.killSwitches?.tenant || []).filter((e) => e.enabled).length}
            </Typography>
            <Box mt={1}>
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                style={{ marginRight: 8 }}
                onClick={() => setConfirmOpen("kill")}
              >
                Kill tenant
              </Button>
              <Button
                size="small"
                variant="contained"
                color="secondary"
                onClick={() => setConfirmOpen("emergency")}
              >
                Emergency stop
              </Button>
            </Box>
          </Paper>

          <Paper className={classes.paper}>
            <Typography variant="h6">Incidents</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Severidade</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(dash?.incidents || []).slice(0, 10).map((i) => (
                  <TableRow key={i.incidentId}>
                    <TableCell className={classes.mono}>{i.incidentId}</TableCell>
                    <TableCell>{i.type}</TableCell>
                    <TableCell>{i.status}</TableCell>
                    <TableCell>{i.severity}</TableCell>
                  </TableRow>
                ))}
                {!(dash?.incidents || []).length ? (
                  <TableRow>
                    <TableCell colSpan={4}>Nenhum incidente</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Paper>

          <Paper className={classes.paper}>
            <Typography variant="body2" className={classes.warn}>
              Esta UI não substitui a segurança backend. Live, Tool WRITE e MCP WRITE
              permanecem desabilitados por padrão. Nenhum cliente externo é ativado aqui.
            </Typography>
          </Paper>
        </>
      )}

      <Dialog open={Boolean(confirmOpen)} onClose={() => setConfirmOpen(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirmar operação crítica</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Ação: {confirmOpen}. Informe o motivo obrigatório.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Motivo"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(null)}>Cancelar</Button>
          <Button
            color="primary"
            variant="contained"
            onClick={() =>
              withReason(async (r) => {
                if (confirmOpen === "INTERNAL_ONLY" || confirmOpen === "SHADOW") {
                  await transitionRollout({
                    to: confirmOpen,
                    expectedVersion: rollout?.version,
                    reason: r,
                    acceptWarnings: true,
                  });
                } else if (confirmOpen === "suspend") {
                  await suspendRollout({
                    expectedVersion: rollout?.version,
                    reason: r,
                  });
                } else if (confirmOpen === "rollback") {
                  await rollbackRollout({
                    expectedVersion: rollout?.version,
                    reason: r,
                  });
                } else if (confirmOpen === "kill") {
                  await setKillSwitch({
                    scope: "tenant",
                    resourceId: String(rollout?.companyId || ""),
                    enabled: true,
                    reason: r,
                  });
                } else if (confirmOpen === "emergency") {
                  await emergencyStop({ reason: r, scope: "tenant" });
                }
              })
            }
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
};

export default AutomationProduction;
