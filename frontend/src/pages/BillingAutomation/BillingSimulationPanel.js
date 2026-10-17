import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Chip from "@material-ui/core/Chip";
import Link from "@material-ui/core/Link";
import Alert from "@material-ui/lab/Alert";
import AlertTitle from "@material-ui/lab/AlertTitle";
import { makeStyles } from "@material-ui/core/styles";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AppSectionCard, AppSecondaryButton, AppLoadingState, AppEmptyState } from "../../ui";
import AppTableContainer from "../../ui/components/AppTableContainer";
import {
  financialStatusLabel,
  blockKindLabel,
  formatDomainDate,
} from "../../components/CompaniesManager/billingStatusHelpers";

const useStyles = makeStyles((theme) => ({
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  kpi: {
    height: "100%",
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  kpiLabel: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: theme.palette.text.secondary,
    lineHeight: 1.3,
  },
  kpiValue: {
    fontWeight: 700,
    fontSize: "1.375rem",
    marginTop: theme.spacing(0.5),
  },
  controls: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    alignItems: "center",
  },
  reasons: {
    margin: 0,
    paddingLeft: theme.spacing(2),
    fontSize: "0.8125rem",
    lineHeight: 1.45,
  },
}));

export const SUMMARY_ITEMS = [
  { key: "wouldBlock", label: "Seriam bloqueadas" },
  { key: "inGrace", label: "Em carência" },
  { key: "active", label: "Ativas" },
  { key: "wouldWarnBeforeDue", label: "Aviso antes do vencimento" },
  { key: "wouldWarnAfterDue", label: "Aviso após o vencimento" },
  { key: "noDueDate", label: "Sem vencimento" },
  { key: "blockedManual", label: "Já bloqueadas manualmente" },
  { key: "blockedFinancial", label: "Já bloqueadas por inadimplência" },
  { key: "blockedUnknown", label: "Bloqueadas (origem não identificada)" },
  { key: "total", label: "Total de empresas" },
];

const ROW_FILTERS = [
  { value: "all", label: "Todas as empresas" },
  { value: "attention", label: "Só as que pedem atenção" },
  { value: "wouldBlock", label: "Seriam bloqueadas" },
  { value: "inGrace", label: "Em carência" },
  { value: "warn", label: "Receberiam aviso" },
];

function needsAttention(c) {
  return (
    c.wouldBlock ||
    c.wouldWarnBeforeDue ||
    c.wouldWarnAfterDue ||
    c.financialStatus === "carencia" ||
    c.financialStatus === "vencido" ||
    c.operationalStatus === "bloqueada"
  );
}

function filterRows(list, mode) {
  switch (mode) {
    case "attention":
      return list.filter(needsAttention);
    case "wouldBlock":
      return list.filter((c) => c.wouldBlock);
    case "inGrace":
      return list.filter((c) => c.financialStatus === "carencia");
    case "warn":
      return list.filter((c) => c.wouldWarnBeforeDue || c.wouldWarnAfterDue);
    default:
      return list;
  }
}

function statusText(c) {
  const parts = [financialStatusLabel(c.financialStatus)];
  if (c.operationalStatus === "bloqueada") {
    parts.push(blockKindLabel(c.blockKind) || "Bloqueada");
  }
  if (c.wouldBlock) parts.push("Seria bloqueada");
  if (c.wouldWarnBeforeDue) parts.push("Receberia aviso antes do vencimento");
  if (c.wouldWarnAfterDue) parts.push("Receberia aviso de atraso");
  return parts.filter(Boolean);
}

/**
 * Simulação da automação de cobrança — SOMENTE LEITURA (Fase 8.4-F, contrato C2).
 * GET /saas/billing-automation/simulation?today=YYYY-MM-DD
 * Esta tela não executa o job, não envia avisos e não bloqueia empresas. Não adicionar
 * aqui nenhum botão que dispare o job.
 */
export default function BillingSimulationPanel() {
  const classes = useStyles();
  const [today, setToday] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [rowFilter, setRowFilter] = useState("all");

  const load = useCallback(async (refDate) => {
    setLoading(true);
    try {
      const { data: res } = await api.get("/saas/billing-automation/simulation", {
        params: refDate ? { today: refDate } : {},
      });
      setData(res || null);
      setUnavailable(false);
    } catch (e) {
      setData(null);
      if (e?.response?.status === 404 && !e?.response?.data?.error) setUnavailable(true);
      else toastError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  const rows = useMemo(
    () => filterRows(Array.isArray(data?.companies) ? data.companies : [], rowFilter),
    [data, rowFilter]
  );

  const summary = data?.summary || {};
  const legacy = data?.jobMode !== "normalized";

  return (
    <Box className={classes.stack}>
      <Alert severity="warning" variant="outlined" data-testid="simulation-readonly-warning">
        <AlertTitle>Simulação — somente leitura</AlertTitle>
        Esta tela apenas mostra o que a automação faria com as configurações atuais. Nada é executado: nenhum
        aviso é enviado, nenhuma empresa é bloqueada ou desbloqueada e nenhuma cobrança é criada.
      </Alert>

      <AppSectionCard>
        <Box className={classes.controls}>
          <TextField
            label="Data de referência (opcional)"
            type="date"
            size="small"
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            value={today}
            onChange={(e) => setToday(e.target.value)}
            helperText="Em branco = hoje"
            inputProps={{ "data-testid": "simulation-date" }}
          />
          <AppSecondaryButton onClick={() => load(today)} loading={loading}>
            Recalcular simulação
          </AppSecondaryButton>
          {data?.today ? (
            <Typography variant="body2" color="textSecondary">
              Simulado para {formatDomainDate(data.today)}
            </Typography>
          ) : null}
        </Box>
      </AppSectionCard>

      {unavailable ? (
        <Alert severity="info">
          A simulação ainda não está disponível neste servidor. Atualize o sistema e tente novamente.
        </Alert>
      ) : null}

      {loading && !data ? <AppLoadingState message="Calculando simulação…" /> : null}

      {data ? (
        <>
          <Alert severity={legacy ? "info" : "success"} data-testid="simulation-job-mode">
            {legacy ? (
              <>
                <strong>Modo legado:</strong> o job atual não está avaliando vencimentos gravados como data —
                bloqueios automáticos inativos na prática. Os números abaixo mostram o que aconteceria se a
                avaliação estivesse normalizada.
              </>
            ) : (
              <>
                <strong>Modo normalizado:</strong> o job avalia os vencimentos gravados como data. Os bloqueios e
                avisos automáticos seguem as configurações da guia “Avisos e bloqueios”.
              </>
            )}
          </Alert>

          <Grid container spacing={2} data-testid="simulation-summary">
            {SUMMARY_ITEMS.map((it) => (
              <Grid item xs={6} sm={4} md={3} key={it.key}>
                <Box className={classes.kpi}>
                  <Typography className={classes.kpiLabel}>{it.label}</Typography>
                  <Typography className={classes.kpiValue} data-testid={`summary-${it.key}`}>
                    {Number(summary[it.key]) || 0}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          <AppSectionCard>
            <Box className={classes.controls} marginBottom={2}>
              <TextField
                select
                size="small"
                variant="outlined"
                label="Mostrar"
                value={rowFilter}
                onChange={(e) => setRowFilter(e.target.value)}
                style={{ minWidth: 240 }}
              >
                {ROW_FILTERS.map((f) => (
                  <MenuItem key={f.value} value={f.value}>
                    {f.label}
                  </MenuItem>
                ))}
              </TextField>
              <Typography variant="body2" color="textSecondary">
                {rows.length} empresa{rows.length === 1 ? "" : "s"}
              </Typography>
            </Box>
            <AppTableContainer nested>
              <Table size="small" aria-label="Simulação por empresa">
                <TableHead>
                  <TableRow>
                    <TableCell>Empresa</TableCell>
                    <TableCell>Vencimento</TableCell>
                    <TableCell>Dias de atraso</TableCell>
                    <TableCell>Situação</TableCell>
                    <TableCell>Por quê</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.companyId}>
                      <TableCell>
                        <Link component={RouterLink} to={`/saas/companies/${c.companyId}`} underline="hover">
                          {c.name || `Empresa #${c.companyId}`}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDomainDate(c.dueDate)}</TableCell>
                      <TableCell>{c.daysLate != null && c.daysLate > 0 ? c.daysLate : "—"}</TableCell>
                      <TableCell>
                        <Box display="flex" flexWrap="wrap" style={{ gap: 4 }}>
                          {statusText(c).map((t) => (
                            <Chip key={t} size="small" variant="outlined" label={t} />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {Array.isArray(c.reasons) && c.reasons.length ? (
                          <ul className={classes.reasons}>
                            {c.reasons.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!rows.length ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <AppEmptyState title="Nenhuma empresa neste filtro" />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </AppTableContainer>
          </AppSectionCard>
        </>
      ) : null}
    </Box>
  );
}
