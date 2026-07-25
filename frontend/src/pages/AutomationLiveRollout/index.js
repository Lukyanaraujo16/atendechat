import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import AgentOsReadOnlyBanner from "../../components/AgentOsReadOnlyBanner";
import { AuthContext } from "../../context/Auth/AuthContext";
import { canManageAgentOsRollout } from "../../config/agentOsPlatformPermissions";
import { toastAgentOsActionError } from "../../utils/agentOsActionError";
import { i18n } from "../../translate/i18n";
import {
  advanceLiveProgressive,
  getLiveRolloutDashboard,
  getLiveTargets,
  postLiveKillSwitch,
  postLiveRollback,
  testLiveRollout,
  updateLiveAgentSetting,
  updateLiveCompanySetting,
  updateLiveConnectionSetting,
  updateLiveRollout,
} from "../../services/automationLiveRolloutApi";

const useStyles = makeStyles((theme) => ({
  paper: { padding: theme.spacing(2), marginBottom: theme.spacing(2) },
  card: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    height: "100%",
  },
  mono: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    whiteSpace: "pre",
    maxHeight: 320,
    overflow: "auto",
    WebkitOverflowScrolling: "touch",
  },
}));

function Metric({ label, value, classes }) {
  return (
    <Box className={classes.card}>
      <Typography variant="caption" color="textSecondary">
        {label}
      </Typography>
      <Typography variant="h6">{value ?? "—"}</Typography>
    </Box>
  );
}

export default function AutomationLiveRolloutPage() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const canWrite = canManageAgentOsRollout(user);
  const companyLabel =
    user?.company?.name ||
    user?.companyName ||
    (user?.companyId != null ? `#${user.companyId}` : "—");
  const [dash, setDash] = useState(null);
  const [targets, setTargets] = useState(null);
  const [stage, setStage] = useState("DISABLED");
  const [percent, setPercent] = useState(0);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      const [{ data }, t] = await Promise.all([
        getLiveRolloutDashboard(),
        getLiveTargets(),
      ]);
      setDash(data);
      setTargets(t.data);
      setStage(data?.config?.stage || "DISABLED");
      setPercent(data?.config?.percent || 0);
    } catch (err) {
      toastAgentOsActionError(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveRollout = async () => {
    setSaving(true);
    try {
      await updateLiveRollout({
        stage,
        percent: Number(percent),
        allowWriteToolsLive: false,
      });
      toast.success("Rollout salvo (Write Tools OFF).");
      await load();
    } catch (err) {
      toastAgentOsActionError(err);
    } finally {
      setSaving(false);
    }
  };

  const runConfirmed = async () => {
    if (!confirmOpen || busy) return;
    setBusy(true);
    try {
      if (confirmOpen === "killOn") {
        await postLiveKillSwitch({ scope: "company", enabled: true });
        toast.warn("Kill switch empresa ATIVO");
      } else if (confirmOpen === "killOff") {
        await postLiveKillSwitch({ scope: "company", enabled: false });
        toast.success("Kill switch desligado");
      } else if (confirmOpen === "rollback") {
        const { data } = await postLiveRollback();
        toast.info(JSON.stringify(data));
      }
      setConfirmOpen(null);
      await load();
    } catch (err) {
      toastAgentOsActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const m = dash?.metrics || {};

  return (
    <MainContainer>
      <MainHeader>
        <Title>Live Rollout</Title>
      </MainHeader>

      <AgentOsReadOnlyBanner visible={!canWrite} />

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="body2" color="textSecondary" paragraph>
          Function Calling Live via estágios (DISABLED → CANARY → PARTIAL →
          FULL). Sem botão global. Write Tools OFF. Fallback legado automático.
        </Typography>
        {dash?.hardening && (
          <Typography variant="caption" color="textSecondary" paragraph>
            Hardening {dash.hardening.version}: {dash.hardening.status}
            {dash.hardening.redis ? " · Redis OK" : " · métricas locais"}
            {dash.hardening.circuit?.state
              ? ` · circuit ${dash.hardening.circuit.state}`
              : ""}
          </Typography>
        )}
        <FormControlLabel
          control={
            <Switch
              checked={dash?.companyEnabled === true}
              disabled={!canWrite}
              onChange={async (e) => {
                await updateLiveCompanySetting({ enabled: e.target.checked });
                await load();
              }}
              color="primary"
            />
          }
          label="Empresa — Function Calling Live (gate)"
        />
        <Grid container spacing={2} style={{ marginTop: 8 }}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth variant="outlined" size="small" disabled={!canWrite}>
              <InputLabel>Stage</InputLabel>
              <Select
                label="Stage"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
              >
                {[
                  "DISABLED",
                  "SIMULATOR",
                  "SHADOW",
                  "CANARY",
                  "PARTIAL",
                  "FULL",
                ].map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Percentual canary"
              type="number"
              variant="outlined"
              size="small"
              fullWidth
              value={percent}
              disabled={!canWrite}
              onChange={(e) => setPercent(e.target.value)}
              helperText="5 / 10 / 25 / 50 / 100"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            {canWrite && (
              <Button
                variant="contained"
                color="primary"
                onClick={saveRollout}
                disabled={saving}
              >
                Salvar rollout
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2}>
        {[
          ["Execuções Live", m.liveExecutions],
          ["Elegíveis", m.eligibleExecutions],
          ["Inelegíveis", m.ineligibleExecutions],
          ["Fallbacks", m.fallbacks],
          ["Rollbacks", m.rollbacks],
          ["Canary %", Math.round((m.canaryRate || 0) * 100)],
          ["Agentes ON", dash?.agentsEnabled],
          ["Conexões ON", dash?.connectionsEnabled],
          ["Readiness", dash?.readiness?.level],
        ].map(([label, value]) => (
          <Grid item xs={6} md={3} key={label}>
            <Metric label={label} value={value} classes={classes} />
          </Grid>
        ))}
      </Grid>

      <Paper className={classes.paper} variant="outlined" style={{ marginTop: 16 }}>
        <Typography variant="subtitle2" gutterBottom>
          Agentes / Conexões / Kill Switch / Ações
        </Typography>
        <Box mb={1}>
          {(targets?.agents || []).map((a) => (
            <FormControlLabel
              key={a.id}
              control={
                <Switch
                  size="small"
                  color="primary"
                  disabled={!canWrite}
                  checked={a.functionCallingLive === true}
                  onChange={async (e) => {
                    await updateLiveAgentSetting(a.id, {
                      enabled: e.target.checked,
                    });
                    await load();
                  }}
                />
              }
              label={`${a.name} (#${a.id})`}
            />
          ))}
        </Box>
        <Box mb={1}>
          {(targets?.connections || []).map((c) => (
            <FormControlLabel
              key={c.id}
              control={
                <Switch
                  size="small"
                  color="primary"
                  disabled={!canWrite}
                  checked={c.functionCallingLive === true}
                  onChange={async (e) => {
                    await updateLiveConnectionSetting(c.id, {
                      enabled: e.target.checked,
                    });
                    await load();
                  }}
                />
              }
              label={`${c.name} (#${c.id})`}
            />
          ))}
        </Box>
        {canWrite && (
          <>
        <Button
          size="small"
          variant="outlined"
          color="secondary"
          onClick={() => setConfirmOpen("killOn")}
          style={{ marginRight: 8 }}
          disabled={busy}
        >
          Kill Switch ON
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setConfirmOpen("killOff")}
          style={{ marginRight: 8 }}
          disabled={busy}
        >
          Kill Switch OFF
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setConfirmOpen("rollback")}
          style={{ marginRight: 8 }}
          disabled={busy}
        >
          Auto Rollback
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const { data } = await advanceLiveProgressive();
              toast.info(JSON.stringify(data));
              await load();
            } catch (err) {
              toastAgentOsActionError(err);
            } finally {
              setBusy(false);
            }
          }}
        >
          Advance Progressive
        </Button>
          </>
        )}
      </Paper>

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="subtitle2" gutterBottom>
          Eligibility / Canary Tester
        </Typography>
        {canWrite ? (
          <Button
            variant="contained"
            color="primary"
            onClick={async () => {
              try {
                const { data } = await testLiveRollout({
                  adminTestMode: true,
                  skipReadiness: true,
                  whatsappId: targets?.connections?.[0]?.id || 1,
                  aiAgentId: targets?.agents?.[0]?.id || 1,
                  ticketId: 1,
                  messageId: "tester-1",
                  provider: "openai",
                  message: {
                    fromMe: false,
                    mediaType: "chat",
                    ticketStatus: "open",
                    userId: null,
                  },
                });
                setTestResult(data);
              } catch (err) {
                toastAgentOsActionError(err);
              }
            }}
          >
            Testar Eligibility
          </Button>
        ) : null}
        {testResult && (
          <pre className={classes.mono}>{JSON.stringify(testResult, null, 2)}</pre>
        )}
      </Paper>

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="subtitle2">Comparação Shadow × Live / Kill</Typography>
        <pre className={classes.mono}>
          {JSON.stringify(
            {
              comparison: dash?.comparison,
              killSwitch: dash?.killSwitch,
              config: dash?.config,
            },
            null,
            2
          )}
        </pre>
      </Paper>

      <Dialog
        open={Boolean(confirmOpen)}
        onClose={() => !busy && setConfirmOpen(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {confirmOpen === "rollback"
            ? i18n.t("technicalConsole.confirm.rollbackTitle")
            : i18n.t("technicalConsole.confirm.killTitle")}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {confirmOpen === "rollback"
              ? i18n.t("technicalConsole.confirm.rollbackBody", {
                  company: companyLabel,
                })
              : i18n.t("technicalConsole.confirm.killBody", {
                  company: companyLabel,
                })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(null)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            color="secondary"
            variant="contained"
            onClick={runConfirmed}
            disabled={busy}
          >
            {confirmOpen === "rollback"
              ? i18n.t("technicalConsole.confirm.rollbackConfirm")
              : i18n.t("technicalConsole.confirm.killConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
}
