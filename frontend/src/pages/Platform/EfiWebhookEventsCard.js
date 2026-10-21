import React, { useCallback, useEffect, useState } from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Chip from "@material-ui/core/Chip";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Checkbox from "@material-ui/core/Checkbox";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AppSectionCard, AppPrimaryButton, AppSecondaryButton } from "../../ui";

const useStyles = makeStyles((theme) => ({
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
    marginTop: theme.spacing(1),
  },
  alert: { color: theme.palette.error.main, fontWeight: 600 },
  clickable: { cursor: "pointer" },
  pre: {
    maxHeight: 220,
    overflow: "auto",
    fontSize: "0.75rem",
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.action.hover,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  },
  section: { marginTop: theme.spacing(2) },
}));

const STATUS_OPTIONS = [
  ["", "Todos"],
  ["pending", "Pendentes"],
  ["received", "Recebido"],
  ["processing", "Processando"],
  ["retry_scheduled", "Retentativa agendada"],
  ["applied", "Aplicado"],
  ["replay", "Replay"],
  ["reconciliation", "Conciliação"],
  ["unlinked", "Sem vínculo"],
  ["ignored_not_saas", "Ignorado (não-SaaS)"],
  ["invalid_permanent", "Inválido"],
  ["failed_exhausted", "Retentativas esgotadas"],
];
const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.filter(([k]) => k));

const MIN_NOTE = 5;
const PAGE_SIZE = 20;

const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");
const fmtMoney = (v) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : String(v);
};
const shortTxid = (t) => (t ? (t.length > 8 ? `…${t.slice(-8)}` : t) : "—");
const fmtAge = (sec) => (sec == null ? "—" : `${Math.round(Number(sec) / 60)} min`);
const dash = (v) => (v == null || v === "" ? "—" : v);
const statusColor = (s) =>
  ["failed_exhausted", "invalid_permanent"].includes(s)
    ? "secondary"
    : s === "applied"
    ? "primary"
    : "default";

/**
 * Fase 8.3-B3.3 — eventos do webhook Pix (RF3.19), varredura Pix e registro de homologação.
 * Só Super Admin; nenhum segredo é exibido (o backend devolve payload sanitizado).
 */
export default function EfiWebhookEventsCard({ slot }) {
  const classes = useStyles();
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ status: "", txid: "", companyId: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ events: [], total: 0, hasMore: false });
  const [loading, setLoading] = useState(false);

  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [note, setNote] = useState("");
  const [classifyCompanyId, setClassifyCompanyId] = useState("");
  const [classifyInvoiceId, setClassifyInvoiceId] = useState("");
  const [acting, setActing] = useState(false);

  const [sweepDays, setSweepDays] = useState(1);
  const [sweeping, setSweeping] = useState(false);
  const [sweepReport, setSweepReport] = useState(null);

  const [homOpen, setHomOpen] = useState(false);
  const [evidence, setEvidence] = useState({});
  const [homConfirm, setHomConfirm] = useState(false);
  const [homSending, setHomSending] = useState(false);
  const [homResult, setHomResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (applied.status) params.status = applied.status;
      if (applied.txid.trim()) params.txid = applied.txid.trim();
      if (applied.companyId) params.companyId = applied.companyId;
      const [statsRes, listRes] = await Promise.all([
        api.get("/saas/finance/efi/webhook-events/stats"),
        api.get("/saas/finance/efi/webhook-events", { params }),
      ]);
      setStats(statsRes.data);
      setList(listRes.data || { events: [], total: 0, hasMore: false });
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFilters = () => {
    setPage(1);
    setApplied({ ...filters });
  };

  const openDetail = async (id) => {
    setLoadingDetail(true);
    setNote("");
    setClassifyCompanyId("");
    setClassifyInvoiceId("");
    try {
      const { data } = await api.get(`/saas/finance/efi/webhook-events/${id}`);
      setDetail(data);
    } catch (e) {
      toastError(e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const noteOk = note.trim().length >= MIN_NOTE;

  const runAction = async (path, body, successMsg) => {
    if (!noteOk) {
      toast.error(`Informe uma observação com pelo menos ${MIN_NOTE} caracteres.`);
      return;
    }
    setActing(true);
    try {
      await api.post(`/saas/finance/efi/webhook-events/${detail.id}/${path}`, body);
      toast.success(successMsg);
      setDetail(null);
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setActing(false);
    }
  };

  const reprocess = () =>
    runAction("reprocess", { note: note.trim() }, "Evento enviado para reprocessamento.");

  const convertToReconciliation = () => {
    const companyId = Number(classifyCompanyId);
    if (!Number.isInteger(companyId) || companyId <= 0) {
      toast.error("Informe a empresa para converter em conciliação.");
      return;
    }
    const body = { action: "convert_to_reconciliation", note: note.trim(), companyId };
    if (classifyInvoiceId) body.invoiceId = Number(classifyInvoiceId);
    runAction("classify", body, "Evento convertido em item de conciliação.");
  };

  const markNotSaas = () =>
    runAction(
      "classify",
      { action: "mark_not_saas", note: note.trim() },
      "Evento marcado como não-SaaS."
    );

  const runSweep = async () => {
    if (!window.confirm(`Executar a varredura Pix dos últimos ${sweepDays} dia(s)?`)) return;
    setSweeping(true);
    setSweepReport(null);
    try {
      const { data } = await api.post("/saas/finance/efi/pix-sweep", {
        confirm: true,
        days: sweepDays,
      });
      setSweepReport(data);
      toast.success("Varredura Pix concluída.");
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setSweeping(false);
    }
  };

  const isProduction = slot === "production";
  const evidenceFields = isProduction
    ? [
        ["testReportRef", "Referência do relatório de teste", "text"],
        ["testReportCommit", "Commit do relatório de teste", "text"],
        ["testEventId", "ID do evento de teste", "number"],
      ]
    : [
        ["webhookEventId", "ID do evento do webhook", "number"],
        ["paymentId", "ID do pagamento", "number"],
        ["renewalId", "ID da renovação", "number"],
      ];

  const openHomologation = () => {
    setEvidence({});
    setHomConfirm(false);
    setHomResult(null);
    setHomOpen(true);
  };

  const submitHomologation = async () => {
    const payload = {};
    for (const [key, , type] of evidenceFields) {
      const raw = String(evidence[key] ?? "").trim();
      if (!raw) {
        toast.error("Preencha todas as evidências.");
        return;
      }
      payload[key] = type === "number" ? Number(raw) : raw;
    }
    setHomSending(true);
    try {
      const { data } = await api.post(`/saas/finance/efi/config/${slot}/homologate`, {
        confirm: true,
        evidence: payload,
      });
      setHomResult(data);
      toast.success("Homologação registrada.");
    } catch (e) {
      toastError(e);
    } finally {
      setHomSending(false);
    }
  };

  const byStatus = stats?.byStatus || {};

  return (
    <AppSectionCard>
      <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
        Eventos do webhook Pix
      </Typography>

      {stats ? (
        <Box mt={1}>
          <Typography variant="body2">
            Pipeline ativo: <strong>{stats.pipelineActive ? "Sim" : "Não"}</strong> ·
            Pendentes: <strong>{dash(stats.pending)}</strong> · Pendentes atrasados (&gt;15
            min):{" "}
            <span className={stats.pendingOverdue > 0 ? classes.alert : undefined}>
              {dash(stats.pendingOverdue)}
            </span>{" "}
            · Pendente mais antigo: {fmtAge(stats.oldestPendingAgeSec)} · Locks antigos:{" "}
            {dash(stats.staleProcessing)} · Eventos sem job: {dash(stats.eventsWithoutJob)}
          </Typography>
          {stats.queue ? (
            <Typography variant="caption" color="textSecondary" component="p">
              Fila: disponíveis {dash(stats.queue.available)} · aguardando{" "}
              {dash(stats.queue.waiting)} · atrasados {dash(stats.queue.delayed)} · ativos{" "}
              {dash(stats.queue.active)}
            </Typography>
          ) : null}
          <Box className={classes.row}>
            {Object.entries(byStatus).map(([s, count]) => (
              <Chip
                key={s}
                size="small"
                variant="outlined"
                label={`${STATUS_LABELS[s] || s}: ${count}`}
              />
            ))}
          </Box>
        </Box>
      ) : null}

      <Box className={classes.row}>
        <TextField
          select
          size="small"
          variant="outlined"
          label="Status"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          style={{ minWidth: 200 }}
        >
          {STATUS_OPTIONS.map(([value, label]) => (
            <MenuItem key={value || "all"} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          variant="outlined"
          label="txid"
          value={filters.txid}
          onChange={(e) => setFilters((f) => ({ ...f, txid: e.target.value }))}
          inputProps={{ maxLength: 35 }}
        />
        <TextField
          size="small"
          variant="outlined"
          label="Empresa (ID)"
          type="number"
          value={filters.companyId}
          onChange={(e) => setFilters((f) => ({ ...f, companyId: e.target.value }))}
          inputProps={{ min: 1 }}
        />
        <AppSecondaryButton onClick={applyFilters} disabled={loading}>
          {loading ? "Carregando..." : "Filtrar"}
        </AppSecondaryButton>
      </Box>

      <Box mt={1} style={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>txid</TableCell>
              <TableCell>Valor</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Fatura</TableCell>
              <TableCell>Tentativas</TableCell>
              <TableCell>Motivo</TableCell>
              <TableCell>Recebido em</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(list.events || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={10}>
                  <Typography variant="body2" color="textSecondary">
                    {loading ? "Carregando..." : "Nenhum evento encontrado."}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              list.events.map((ev) => (
                <TableRow
                  key={ev.id}
                  hover
                  className={classes.clickable}
                  onClick={() => openDetail(ev.id)}
                >
                  <TableCell>{ev.id}</TableCell>
                  <TableCell>{dash(ev.eventType)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={statusColor(ev.status)}
                      label={STATUS_LABELS[ev.status] || ev.status}
                    />
                  </TableCell>
                  <TableCell title={ev.txid || ""}>{shortTxid(ev.txid)}</TableCell>
                  <TableCell>{fmtMoney(ev.amount)}</TableCell>
                  <TableCell>{dash(ev.companyId)}</TableCell>
                  <TableCell>{dash(ev.invoiceId)}</TableCell>
                  <TableCell>{dash(ev.attempts)}</TableCell>
                  <TableCell>{dash(ev.reason)}</TableCell>
                  <TableCell>{fmtDate(ev.receivedAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Box>
      <Box className={classes.row}>
        <AppSecondaryButton
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={loading || page <= 1}
        >
          Anterior
        </AppSecondaryButton>
        <Typography variant="body2">
          Página {page} · {list.total || 0} evento(s)
        </Typography>
        <AppSecondaryButton
          onClick={() => setPage((p) => p + 1)}
          disabled={loading || !list.hasMore}
        >
          Próxima
        </AppSecondaryButton>
      </Box>

      <Box className={classes.section}>
        <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
          Varredura Pix e homologação
        </Typography>
        <Box className={classes.row}>
          <TextField
            select
            size="small"
            variant="outlined"
            label="Período"
            value={sweepDays}
            onChange={(e) => setSweepDays(Number(e.target.value))}
            style={{ minWidth: 140 }}
          >
            {[1, 7, 30].map((d) => (
              <MenuItem key={d} value={d}>
                {d === 1 ? "Último dia" : `Últimos ${d} dias`}
              </MenuItem>
            ))}
          </TextField>
          <AppSecondaryButton onClick={runSweep} disabled={sweeping}>
            {sweeping ? "Executando..." : "Varredura Pix"}
          </AppSecondaryButton>
          <AppPrimaryButton onClick={openHomologation}>Registrar homologação</AppPrimaryButton>
        </Box>
        {sweepReport ? (
          <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
            Varredura de {dash(sweepReport.days)} dia(s): {dash(sweepReport.checked)}{" "}
            verificada(s) · concluídas sem baixa: {dash(sweepReport.concludedWithoutPayment)} ·
            itens de conciliação criados: {dash(sweepReport.itemsCreated)} · pendentes no
            pipeline: {dash(sweepReport.pendingInPipeline)} · erros:{" "}
            {Array.isArray(sweepReport.errors)
              ? sweepReport.errors.length
              : dash(sweepReport.errors)}
          </Typography>
        ) : null}
      </Box>

      <Dialog open={!!detail} onClose={() => !acting && setDetail(null)} maxWidth="md" fullWidth>
        <DialogTitle>Evento #{detail?.id}</DialogTitle>
        {detail ? (
          <DialogContent dividers>
            <Typography variant="body2">
              Tipo: <strong>{dash(detail.eventType)}</strong> · Status:{" "}
              <strong>{STATUS_LABELS[detail.status] || detail.status}</strong> · Tentativas:{" "}
              {dash(detail.attempts)}
            </Typography>
            <Typography variant="body2">
              txid: {dash(detail.txid)} · E2E: {dash(detail.endToEndId)} · Valor:{" "}
              {fmtMoney(detail.amount)}
            </Typography>
            <Typography variant="body2">
              Empresa: {dash(detail.companyId)} · Fatura: {dash(detail.invoiceId)} · Pagamento:{" "}
              {dash(detail.paymentId)} · Conciliação: {dash(detail.reconciliationItemId)}
            </Typography>
            <Typography variant="body2">
              Recebido: {fmtDate(detail.receivedAt)} · Processado: {fmtDate(detail.processedAt)}{" "}
              · Próxima tentativa: {fmtDate(detail.nextAttemptAt)}
            </Typography>
            <Typography variant="body2">
              Lock: {dash(detail.lockedBy)} ({fmtDate(detail.lockedAt)}) · Motivo:{" "}
              {dash(detail.reason)}
            </Typography>
            {detail.lastError ? (
              <Typography variant="body2" className={classes.alert}>
                Último erro: {detail.lastError}
              </Typography>
            ) : null}

            <Box className={classes.section}>
              <Typography variant="subtitle2">Payload</Typography>
              <pre className={classes.pre}>{JSON.stringify(detail.payload ?? null, null, 2)}</pre>
              {detail.result != null ? (
                <>
                  <Typography variant="subtitle2">Resultado</Typography>
                  <pre className={classes.pre}>{JSON.stringify(detail.result, null, 2)}</pre>
                </>
              ) : null}
            </Box>

            <Box className={classes.section}>
              <Typography variant="subtitle2">Tentativas de processamento</Typography>
              {(detail.attemptLog || []).length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  Nenhuma tentativa registrada.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Quando</TableCell>
                      <TableCell>Worker</TableCell>
                      <TableCell>Resultado</TableCell>
                      <TableCell>Motivo / erro</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.attemptLog.map((a, i) => (
                      <TableRow key={`${a.at}-${i}`}>
                        <TableCell>{fmtDate(a.at)}</TableCell>
                        <TableCell>{dash(a.worker)}</TableCell>
                        <TableCell>{dash(a.result)}</TableCell>
                        <TableCell>{dash(a.reason || a.error)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>

            <Box className={classes.section}>
              <Typography variant="subtitle2">Histórico de ações</Typography>
              {(detail.adminActions || []).length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  Nenhuma ação administrativa.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Quando</TableCell>
                      <TableCell>Usuário</TableCell>
                      <TableCell>Ação</TableCell>
                      <TableCell>Status anterior</TableCell>
                      <TableCell>Observação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.adminActions.map((a, i) => (
                      <TableRow key={`${a.at}-${i}`}>
                        <TableCell>{fmtDate(a.at)}</TableCell>
                        <TableCell>{dash(a.actorUserId)}</TableCell>
                        <TableCell>{dash(a.action)}</TableCell>
                        <TableCell>{STATUS_LABELS[a.fromStatus] || dash(a.fromStatus)}</TableCell>
                        <TableCell>{dash(a.note)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>

            {detail.reprocessable || detail.status === "unlinked" ? (
              <Box className={classes.section}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Observação (obrigatória)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  error={note.length > 0 && !noteOk}
                  helperText={`Mínimo de ${MIN_NOTE} caracteres.`}
                  multiline
                  minRows={2}
                />
                {detail.status === "unlinked" ? (
                  <Box className={classes.row}>
                    <TextField
                      size="small"
                      variant="outlined"
                      type="number"
                      label="Empresa (ID) *"
                      value={classifyCompanyId}
                      onChange={(e) => setClassifyCompanyId(e.target.value)}
                      inputProps={{ min: 1 }}
                    />
                    <TextField
                      size="small"
                      variant="outlined"
                      type="number"
                      label="Fatura (ID, opcional)"
                      value={classifyInvoiceId}
                      onChange={(e) => setClassifyInvoiceId(e.target.value)}
                      inputProps={{ min: 1 }}
                    />
                  </Box>
                ) : null}
              </Box>
            ) : null}
          </DialogContent>
        ) : null}
        <DialogActions>
          {detail?.status === "unlinked" ? (
            <>
              <AppSecondaryButton onClick={markNotSaas} disabled={acting || !noteOk}>
                Marcar como não-SaaS
              </AppSecondaryButton>
              <AppSecondaryButton
                onClick={convertToReconciliation}
                disabled={acting || !noteOk || !classifyCompanyId}
              >
                Converter em conciliação
              </AppSecondaryButton>
            </>
          ) : null}
          {detail?.reprocessable ? (
            <AppPrimaryButton onClick={reprocess} disabled={acting || !noteOk}>
              {acting ? "Enviando..." : "Reprocessar"}
            </AppPrimaryButton>
          ) : null}
          <AppSecondaryButton onClick={() => setDetail(null)} disabled={acting}>
            Fechar
          </AppSecondaryButton>
        </DialogActions>
      </Dialog>

      {loadingDetail ? (
        <Typography variant="caption" color="textSecondary">
          Carregando evento...
        </Typography>
      ) : null}

      <Dialog open={homOpen} onClose={() => !homSending && setHomOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Registrar homologação — {isProduction ? "produção" : "homologação"}
        </DialogTitle>
        <DialogContent dividers>
          {evidenceFields.map(([key, label, type]) => (
            <TextField
              key={key}
              fullWidth
              size="small"
              variant="outlined"
              margin="dense"
              type={type}
              label={label}
              value={evidence[key] ?? ""}
              onChange={(e) => setEvidence((ev) => ({ ...ev, [key]: e.target.value }))}
              disabled={!!homResult}
            />
          ))}
          <FormControlLabel
            control={
              <Checkbox
                checked={homConfirm}
                onChange={(e) => setHomConfirm(e.target.checked)}
                disabled={!!homResult}
              />
            }
            label="Confirmo que as evidências acima comprovam o fluxo Pix ponta a ponta neste ambiente."
          />
          {homResult ? (
            <Typography variant="body2" style={{ marginTop: 8 }}>
              Homologado: <strong>{homResult.homologated ? "Sim" : "Não"}</strong> · Commit:{" "}
              {dash(homResult.commit)} · Fingerprint:{" "}
              {homResult.configFingerprint
                ? `${String(homResult.configFingerprint).slice(0, 12)}…`
                : "—"}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <AppSecondaryButton onClick={() => setHomOpen(false)} disabled={homSending}>
            Fechar
          </AppSecondaryButton>
          {!homResult ? (
            <AppPrimaryButton
              onClick={submitHomologation}
              disabled={homSending || !homConfirm}
            >
              {homSending ? "Registrando..." : "Registrar"}
            </AppPrimaryButton>
          ) : null}
        </DialogActions>
      </Dialog>
    </AppSectionCard>
  );
}
