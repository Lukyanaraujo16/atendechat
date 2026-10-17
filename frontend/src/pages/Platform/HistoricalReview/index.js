import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useHistory, useLocation } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Chip from "@material-ui/core/Chip";
import Tooltip from "@material-ui/core/Tooltip";
import Link from "@material-ui/core/Link";
import Alert from "@material-ui/lab/Alert";
import { makeStyles, alpha } from "@material-ui/core/styles";

import MainContainer from "../../../components/MainContainer";
import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import {
  AppPageHeader,
  AppSectionCard,
  AppActionBar,
  AppPrimaryButton,
  AppSecondaryButton,
  AppEmptyState,
  AppLoadingState,
} from "../../../ui";
import AppTableContainer from "../../../ui/components/AppTableContainer";
import HistoricalReviewDialog from "../../../components/CompanyFinanceSection/HistoricalReviewDialog";
import {
  formatBrl,
  formatDate,
  formatCompetence,
  isNotFoundRoute,
} from "../../../components/CompanyFinanceSection/financeFormat";
import { DEFAULT_STATE, STATE_OPTIONS, reviewSituation, signalList } from "./historicalReviewLabels";

export const PAGE_SIZE = 20;
const STATE_VALUES = STATE_OPTIONS.map((o) => o.value);

const useStyles = makeStyles((theme) => {
  const tone = (c, dark) => ({
    backgroundColor: alpha(c, 0.14),
    color: theme.palette.type === "dark" ? dark : c,
    fontWeight: 600,
    maxWidth: "100%",
    height: "auto",
    minHeight: 22,
  });
  return {
    page: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(3),
      width: "100%",
    },
    filters: {
      display: "flex",
      flexWrap: "wrap",
      gap: theme.spacing(2),
      alignItems: "center",
      width: "100%",
    },
    counter: {
      fontWeight: 700,
      fontSize: "1.5rem",
      lineHeight: 1.2,
    },
    signals: {
      display: "flex",
      flexWrap: "wrap",
      gap: theme.spacing(0.5),
    },
    chipLabel: { whiteSpace: "normal", lineHeight: 1.25, paddingTop: 2, paddingBottom: 2 },
    tone_warning: tone(theme.palette.warning.dark, theme.palette.warning.light),
    tone_info: tone(theme.palette.info.main, theme.palette.info.light),
    tone_success: tone(theme.palette.success.dark, theme.palette.success.light),
    signalChip: { height: "auto", minHeight: 22, maxWidth: "100%" },
    pager: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: theme.spacing(1.5),
      marginTop: theme.spacing(2),
    },
    blocked: {
      display: "block",
      marginTop: 4,
      color: theme.palette.type === "dark" ? theme.palette.error.light : theme.palette.error.dark,
    },
  };
});

function readFilters(search) {
  const params = new URLSearchParams(search || "");
  const companyId = params.get("companyId") || "";
  const stateRaw = params.get("state") || DEFAULT_STATE;
  const state = STATE_VALUES.includes(stateRaw) ? stateRaw : DEFAULT_STATE;
  const pageRaw = parseInt(params.get("page") || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  return { companyId, state, page };
}

function buildSearch({ companyId, state, page }) {
  const params = new URLSearchParams();
  if (companyId) params.set("companyId", companyId);
  if (state && state !== DEFAULT_STATE) params.set("state", state);
  if (page && page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `?${s}` : "";
}

/**
 * Fila global de revisão de faturas históricas (Super Admin).
 * Rota: /saas/finance/historical-review?companyId=&state=&page=
 * Sem ações em massa: cada fatura é decidida individualmente no diálogo de revisão.
 */
export default function HistoricalReviewPage() {
  const classes = useStyles();
  const history = useHistory();
  const location = useLocation();
  const filters = useMemo(() => readFilters(location.search), [location.search]);

  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [pendingTotal, setPendingTotal] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [selected, setSelected] = useState(null);

  const setFilters = useCallback(
    (patch) => {
      const next = { ...filters, ...patch };
      history.replace({ pathname: location.pathname, search: buildSearch(next) });
    },
    [filters, history, location.pathname]
  );

  const loadSummary = useCallback(async () => {
    try {
      const { data } = await api.get("/saas/finance/historical-review/summary");
      const total = Number(data?.total);
      setPendingTotal(Number.isFinite(total) ? total : null);
    } catch (e) {
      setPendingTotal(null);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/saas/finance/historical-review", {
        params: {
          companyId: filters.companyId || undefined,
          state: filters.state,
          page: filters.page,
          limit: PAGE_SIZE,
        },
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setCount(Number(data?.count) || 0);
      setHasMore(Boolean(data?.hasMore));
      setUnavailable(false);
    } catch (e) {
      setItems([]);
      setCount(0);
      setHasMore(false);
      if (isNotFoundRoute(e)) setUnavailable(true);
      else toastError(e);
    } finally {
      setLoading(false);
    }
  }, [filters.companyId, filters.state, filters.page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    let alive = true;
    api
      .get("/companies/list")
      .then(({ data }) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];
        setCompanies(
          list
            .map((c) => ({ id: c.id, name: c.name }))
            .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"))
        );
      })
      .catch(() => {
        if (alive) setCompanies([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const companyOptions = useMemo(() => {
    if (!filters.companyId) return companies;
    if (companies.some((c) => String(c.id) === String(filters.companyId))) return companies;
    return [{ id: filters.companyId, name: `Empresa #${filters.companyId}` }, ...companies];
  }, [companies, filters.companyId]);

  const handleDone = async () => {
    setSelected(null);
    await Promise.all([load(), loadSummary()]);
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <MainContainer>
      <Box className={classes.page}>
        <AppPageHeader
          title={
            <Typography variant="h5" component="h1" color="primary">
              Revisão de faturas históricas
            </Typography>
          }
          subtitle={
            <Typography variant="body2" color="textSecondary" component="p" style={{ margin: 0, maxWidth: 760 }}>
              Faturas antigas, criadas antes da reorganização do faturamento, podem ter sido pagas por fora,
              cobradas por engano ou dadas como cortesia — e o sistema não tem como saber. Revise uma por uma e
              registre o que aconteceu. Os indícios abaixo só ajudam a decidir: eles não provam pagamento.
              Nenhuma decisão aqui renova a assinatura.
            </Typography>
          }
          actions={
            <AppSecondaryButton component={RouterLink} to="/saas/finance">
              Voltar ao financeiro
            </AppSecondaryButton>
          }
        />

        <AppActionBar>
          <Box className={classes.filters}>
            <Box minWidth={160}>
              <Typography variant="caption" color="textSecondary" display="block">
                Não resolvidas (todas as empresas)
              </Typography>
              <Typography className={classes.counter} data-testid="historical-pending-total">
                {pendingTotal == null ? "—" : pendingTotal}
              </Typography>
            </Box>
            <TextField
              select
              size="small"
              variant="outlined"
              label="Empresa"
              id="hr-filter-company"
              value={filters.companyId}
              onChange={(e) => setFilters({ companyId: e.target.value, page: 1 })}
              style={{ minWidth: 220 }}
              SelectProps={{ MenuProps: { PaperProps: { style: { maxHeight: 360 } } } }}
              inputProps={{ "data-testid": "filter-company" }}
            >
              <MenuItem value="">Todas as empresas</MenuItem>
              {companyOptions.map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>
                  {c.name || `Empresa #${c.id}`}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              variant="outlined"
              label="Situação"
              id="hr-filter-state"
              value={filters.state}
              onChange={(e) => setFilters({ state: e.target.value, page: 1 })}
              style={{ minWidth: 200 }}
              inputProps={{ "data-testid": "filter-state" }}
            >
              {STATE_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
            <AppSecondaryButton onClick={() => Promise.all([load(), loadSummary()])}>
              Atualizar
            </AppSecondaryButton>
          </Box>
        </AppActionBar>

        {unavailable ? (
          <Alert severity="info">
            A revisão de faturas históricas ainda não está disponível neste servidor. Atualize o sistema e tente
            novamente.
          </Alert>
        ) : null}

        <AppSectionCard>
          {loading && !items.length ? (
            <AppLoadingState message="Carregando faturas…" />
          ) : (
            <>
              <AppTableContainer nested>
                <Table size="small" aria-label="Faturas históricas">
                  <TableHead>
                    <TableRow>
                      <TableCell>Empresa</TableCell>
                      <TableCell>Fatura</TableCell>
                      <TableCell>Competência / vencimento</TableCell>
                      <TableCell>Valor</TableCell>
                      <TableCell>Indícios</TableCell>
                      <TableCell>Situação</TableCell>
                      <TableCell align="right">Ação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item) => {
                      const inv = item.invoice || {};
                      const companyId = item.company?.id ?? inv.companyId;
                      const situation = reviewSituation(item);
                      const signals = signalList(item.signals);
                      return (
                        <TableRow key={inv.id} data-testid={`historical-row-${inv.id}`}>
                          <TableCell>
                            <Link
                              component={RouterLink}
                              to={`/saas/companies/${companyId}/financeiro`}
                              underline="hover"
                            >
                              {item.company?.name || `Empresa #${companyId}`}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" style={{ fontWeight: 600 }}>
                              #{inv.id}
                            </Typography>
                            {inv.detail ? (
                              <Typography variant="caption" color="textSecondary" display="block">
                                {inv.detail}
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{formatCompetence(inv.competence)}</Typography>
                            <Typography variant="caption" color="textSecondary" display="block">
                              Venc. {formatDate(inv.dueDate)}
                            </Typography>
                          </TableCell>
                          <TableCell>{formatBrl(inv.value)}</TableCell>
                          <TableCell>
                            {signals.length ? (
                              <Box className={classes.signals}>
                                {signals.map((s) => (
                                  <Tooltip key={s.key} title={s.help} arrow>
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      label={s.label}
                                      className={classes.signalChip}
                                      classes={{ label: classes.chipLabel }}
                                    />
                                  </Tooltip>
                                ))}
                              </Box>
                            ) : (
                              <Typography variant="caption" color="textSecondary">
                                Nenhum indício encontrado
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={situation.label}
                              className={classes[`tone_${situation.tone}`]}
                              classes={{ label: classes.chipLabel }}
                            />
                            {item.review?.note ? (
                              <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 4 }}>
                                “{item.review.note}”
                              </Typography>
                            ) : null}
                            {item.blockedReason ? (
                              <Typography variant="caption" className={classes.blocked}>
                                {item.blockedReason}
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell align="right">
                            {situation.canReview ? (
                              <AppPrimaryButton size="small" onClick={() => setSelected(item)}>
                                Revisar
                              </AppPrimaryButton>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!items.length && !loading ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <AppEmptyState
                            title={
                              filters.state === "pending" || filters.state === DEFAULT_STATE
                                ? "Nenhuma fatura histórica pendente de revisão"
                                : "Nenhuma fatura encontrada com estes filtros"
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </AppTableContainer>
              <Box className={classes.pager}>
                <Typography variant="body2" color="textSecondary" data-testid="historical-pager">
                  {count} fatura{count === 1 ? "" : "s"} · página {filters.page} de {totalPages}
                </Typography>
                <AppSecondaryButton
                  size="small"
                  disabled={filters.page <= 1 || loading}
                  onClick={() => setFilters({ page: filters.page - 1 })}
                >
                  Anterior
                </AppSecondaryButton>
                <AppSecondaryButton
                  size="small"
                  disabled={!hasMore || loading}
                  onClick={() => setFilters({ page: filters.page + 1 })}
                >
                  Próxima
                </AppSecondaryButton>
              </Box>
            </>
          )}
        </AppSectionCard>
      </Box>

      {selected ? (
        <HistoricalReviewDialog
          open
          companyId={selected.company?.id ?? selected.invoice?.companyId}
          invoice={selected.invoice}
          signals={selected.signals}
          onClose={() => setSelected(null)}
          onDone={handleDone}
        />
      ) : null}
    </MainContainer>
  );
}
