import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Tooltip,
  CircularProgress,
} from "@material-ui/core";
import Button from "@material-ui/core/Button";
import AccountTree from "@material-ui/icons/AccountTree";
import { format, parseISO } from "date-fns";
import api from "../../services/api";
import toastError from "../../errors/toastError";

function summarizeDetails(details) {
  if (details == null || typeof details !== "object") return "—";
  try {
    const s = JSON.stringify(details);
    return s.length > 280 ? `${s.slice(0, 280)}…` : s;
  } catch {
    return "—";
  }
}

const TicketFlowExecutionLogModal = ({ ticketId, renderTrigger }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  const fetchLogs = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/tickets/${ticketId}/flow-execution-logs`);
      const list = Array.isArray(data?.logs) ? data.logs : [];
      setLogs(list);
    } catch (err) {
      toastError(err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (open) fetchLogs();
  }, [open, fetchLogs]);

  const formatWhen = (iso) => {
    if (!iso) return "—";
    try {
      const d = typeof iso === "string" ? parseISO(iso) : new Date(iso);
      return format(d, "dd/MM/yyyy HH:mm:ss");
    } catch {
      return String(iso);
    }
  };

  const openModal = () => setOpen(true);

  return (
    <>
      {typeof renderTrigger === "function" ? (
        renderTrigger(openModal)
      ) : (
        <Tooltip title="Histórico do fluxo (FlowBuilder)">
          <IconButton
            size="small"
            onClick={openModal}
            aria-label="Histórico do fluxo"
          >
            <AccountTree fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="md"
        scroll="paper"
      >
        <DialogTitle>Histórico de execução do fluxo</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="textSecondary" paragraph>
            Eventos registrados durante a execução automática do FlowBuilder neste ticket (ordem
            cronológica).
          </Typography>
          {loading ? (
            <div style={{ textAlign: "center", padding: 24 }}>
              <CircularProgress size={32} />
            </div>
          ) : logs.length === 0 ? (
            <Typography color="textSecondary">
              Nenhum evento registrado para este ticket. O histórico é preenchido quando há fluxo
              ativo com ticket associado.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Data/hora</TableCell>
                    <TableCell>Evento</TableCell>
                    <TableCell>Nó</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Detalhes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell style={{ whiteSpace: "nowrap" }}>
                        {formatWhen(row.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.eventType}</Typography>
                        {row.flowId != null && (
                          <Typography variant="caption" color="textSecondary" display="block">
                            flow #{row.flowId}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.nodeType}</Typography>
                        <Typography variant="caption" color="textSecondary" noWrap title={row.nodeId}>
                          {row.nodeId}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell
                        style={{
                          maxWidth: 280,
                          wordBreak: "break-word",
                          fontSize: 12,
                          fontFamily: "monospace",
                        }}
                      >
                        {summarizeDetails(row.details)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="primary" variant="outlined">
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TicketFlowExecutionLogModal;
