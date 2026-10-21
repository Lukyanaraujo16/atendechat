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
  message: { whiteSpace: "pre-wrap", wordBreak: "break-word", minWidth: 240 },
}));

const KIND_LABELS = {
  gateway_payment_on_settled_invoice: "Possível duplicidade (fatura já quitada)",
  gateway_payment_on_cancelled_invoice: "Pagamento em fatura cancelada",
  gateway_pix_amount_mismatch: "Valor divergente",
  gateway_pix_invoice_not_found: "Fatura não encontrada",
  gateway_pix_link_conflict: "Vínculo divergente",
  gateway_pix_refund: "Devolução Pix",
  gateway_pix_paid_after_refund: "Pix com devolução registrada",
  gateway_pix_not_verifiable: "Notificação não verificável",
  gateway_pix_charge_not_concluded: "Cobrança não concluída",
  gateway_webhook_failed_exhausted: "Retentativas esgotadas",
  gateway_pix_unlinked: "Pix sem txid vinculado",
  pix_sweep_concluded_without_payment: "Varredura: concluída sem baixa",
  manual_pix_no_settle: "Baixa manual Pix",
  gateway_payment_renewal_failed: "Renovação não aplicada",
};

const STATUS_OPTIONS = [
  ["open", "Abertos"],
  ["resolved", "Resolvidos"],
  ["all", "Todos"],
];

const MIN_NOTE = 5;
const PAGE_SIZE = 50;

const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");
const dash = (v) => (v == null || v === "" ? "—" : v);

/**
 * Fase 8.3-B3.3 — fila global de conciliação (RF3.17), só Super Admin.
 * Resolver exige observação; 409 (já resolvido) chega como { error, message }.
 */
export default function EfiReconciliationQueueCard() {
  const classes = useStyles();
  const [filters, setFilters] = useState({ status: "open", kind: "", companyId: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ items: [], total: 0, hasMore: false });
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status: applied.status, page, limit: PAGE_SIZE };
      if (applied.kind) params.kind = applied.kind;
      if (applied.companyId) params.companyId = applied.companyId;
      const { data } = await api.get("/saas/finance/reconciliation", { params });
      setList(data || { items: [], total: 0, hasMore: false });
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

  const noteOk = note.trim().length >= MIN_NOTE;

  const resolve = async () => {
    if (!noteOk) {
      toast.error(`Informe uma observação com pelo menos ${MIN_NOTE} caracteres.`);
      return;
    }
    setSending(true);
    try {
      await api.post(`/saas/finance/reconciliation/${resolving.id}/resolve`, {
        note: note.trim(),
      });
      toast.success("Item de conciliação resolvido.");
      setResolving(null);
    } catch (e) {
      toastError(e);
      if (e?.response?.status === 409) setResolving(null);
    } finally {
      setSending(false);
    }
    await load();
  };

  return (
    <AppSectionCard>
      <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
        Fila global de conciliação
      </Typography>

      <Box className={classes.row}>
        <TextField
          select
          size="small"
          variant="outlined"
          label="Status"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          style={{ minWidth: 140 }}
        >
          {STATUS_OPTIONS.map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          variant="outlined"
          label="Tipo"
          value={filters.kind}
          onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value }))}
          style={{ minWidth: 240 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
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
              <TableCell>Empresa</TableCell>
              <TableCell>Fatura</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Mensagem</TableCell>
              <TableCell>Criado em</TableCell>
              <TableCell>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {(list.items || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography variant="body2" color="textSecondary">
                    {loading ? "Carregando..." : "Nenhum item de conciliação."}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              list.items.map((item) => {
                const resolved = item.status === "resolved";
                const resolution = item.metadata?.resolution;
                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{dash(item.companyId)}</TableCell>
                    <TableCell>{dash(item.invoiceId)}</TableCell>
                    <TableCell title={item.kind}>{KIND_LABELS[item.kind] || item.kind}</TableCell>
                    <TableCell className={classes.message}>
                      {dash(item.message)}
                      {resolved && resolution ? (
                        <Typography variant="caption" color="textSecondary" component="p">
                          Resolução ({fmtDate(resolution.at || item.resolvedAt)}):{" "}
                          {dash(resolution.note)}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>{fmtDate(item.createdAt)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={resolved ? "default" : "secondary"}
                        label={resolved ? "Resolvido" : "Aberto"}
                      />
                    </TableCell>
                    <TableCell>
                      {!resolved ? (
                        <AppSecondaryButton
                          size="small"
                          onClick={() => {
                            setNote("");
                            setResolving(item);
                          }}
                        >
                          Resolver
                        </AppSecondaryButton>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })
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
          Página {page} · {list.total || 0} item(ns)
        </Typography>
        <AppSecondaryButton
          onClick={() => setPage((p) => p + 1)}
          disabled={loading || !list.hasMore}
        >
          Próxima
        </AppSecondaryButton>
      </Box>

      <Dialog
        open={!!resolving}
        onClose={() => !sending && setResolving(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Resolver item #{resolving?.id}</DialogTitle>
        <DialogContent dividers>
          {resolving ? (
            <Typography variant="body2" className={classes.message} gutterBottom>
              {KIND_LABELS[resolving.kind] || resolving.kind} — {dash(resolving.message)}
            </Typography>
          ) : null}
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
            minRows={3}
          />
        </DialogContent>
        <DialogActions>
          <AppSecondaryButton onClick={() => setResolving(null)} disabled={sending}>
            Cancelar
          </AppSecondaryButton>
          <AppPrimaryButton onClick={resolve} disabled={sending || !noteOk}>
            {sending ? "Resolvendo..." : "Resolver"}
          </AppPrimaryButton>
        </DialogActions>
      </Dialog>
    </AppSectionCard>
  );
}
