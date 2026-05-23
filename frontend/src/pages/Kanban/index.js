import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from "react";
import clsx from "clsx";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Box from "@material-ui/core/Box";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Chip from "@material-ui/core/Chip";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Skeleton from "@material-ui/lab/Skeleton";
import InboxOutlinedIcon from "@material-ui/icons/InboxOutlined";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
import SearchIcon from "@material-ui/icons/Search";
import ClearIcon from "@material-ui/icons/Clear";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import api from "../../services/api";
import { getApiUrl } from "../../config/backendUrl";
import { AuthContext } from "../../context/Auth/AuthContext";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import { i18n } from "../../translate/i18n";
import { useHistory } from "react-router-dom";
import useUsers from "../../hooks/useUsers";
import toastError from "../../errors/toastError";
import KanbanTicketQuickMenu from "./KanbanTicketQuickMenu";
import {
  KANBAN_CLOSED_PERIOD_OPTIONS,
  readKanbanClosedPeriodFromStorage,
  ticketMatchesKanbanClosedPeriod,
  writeKanbanClosedPeriodToStorage,
} from "../../utils/kanbanClosedPeriod";
import {
  getInitialKanbanCollapsedColumns,
  hasKanbanCollapsedColumnsPreference,
  shouldDefaultCollapseClosedColumn,
  writeKanbanCollapsedColumnsToStorage,
} from "../../utils/kanbanCollapsedColumns";
import {
  KANBAN_COLUMN_PAGE_SIZE,
  getColumnVisibleMeta,
  getInitialKanbanVisibleLimits,
  nextVisibleLimit,
} from "../../utils/kanbanColumnVisibleLimit";
import { filterTicketsByKanbanSearch } from "../../utils/kanbanSearch";

const KANBAN_SEARCH_DEBOUNCE_MS = 300;

const COLUMN_ORDER = [
  { key: "pending", labelKey: "kanban.column.pending", accent: "pending" },
  { key: "open", labelKey: "kanban.column.open", accent: "open" },
  { key: "closed", labelKey: "kanban.column.closed", accent: "closed" },
];

const emptyColumns = () => ({
  pending: [],
  open: [],
  closed: [],
});

const truncateText = (s, max = 88) => {
  if (s == null || s === "") return "—";
  const t = String(s).trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
};

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    padding: theme.spacing(2),
    backgroundColor: theme.palette.type === "dark" ? theme.palette.background.default : "#f0f2f5",
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(1),
    },
  },
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    borderRadius: 12,
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
    border: `1px solid ${theme.palette.divider}`,
  },
  filterControl: {
    minWidth: 160,
    [theme.breakpoints.down("xs")]: {
      minWidth: "100%",
    },
  },
  searchControl: {
    flex: "1 1 240px",
    minWidth: 220,
    [theme.breakpoints.down("xs")]: {
      flex: "1 1 100%",
      minWidth: "100%",
    },
  },
  searchField: {
    "& .MuiOutlinedInput-root": {
      backgroundColor: theme.palette.background.default,
    },
  },
  filteringHint: {
    width: "100%",
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(-1),
    marginBottom: theme.spacing(0.5),
  },
  boardRow: {
    display: "flex",
    flex: 1,
    gap: theme.spacing(2),
    minHeight: 440,
    alignItems: "stretch",
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: theme.spacing(1),
    WebkitOverflowScrolling: "touch",
    [theme.breakpoints.down("sm")]: {
      gap: theme.spacing(1.5),
    },
  },
  column: {
    flex: "1 1 280px",
    minWidth: 260,
    maxWidth: 400,
    display: "flex",
    flexDirection: "column",
    backgroundColor: theme.palette.background.paper,
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
    border: "2px solid transparent",
    transition:
      "box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease, flex-basis 0.2s ease, min-width 0.2s ease, max-width 0.2s ease",
    maxHeight: "min(calc(100vh - 200px), 720px)",
    [theme.breakpoints.down("xs")]: {
      minWidth: "min(100%, 320px)",
      flex: "0 0 auto",
    },
  },
  columnCollapsed: {
    flex: "0 0 152px",
    minWidth: 152,
    maxWidth: 168,
    [theme.breakpoints.down("xs")]: {
      minWidth: 140,
      flex: "0 0 140px",
    },
  },
  columnDropActive: {
    boxShadow: `0 0 0 3px ${theme.palette.primary.light}, 0 4px 20px rgba(25, 118, 210, 0.2)`,
    borderColor: theme.palette.primary.main,
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(25, 118, 210, 0.12)" : "rgba(227, 242, 253, 0.95)",
  },
  columnHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
  },
  columnHeaderCollapsed: {
    flexDirection: "column",
    alignItems: "stretch",
    padding: theme.spacing(1, 1.25),
    gap: theme.spacing(0.75),
  },
  columnHeaderMain: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    minWidth: 0,
    flex: 1,
  },
  collapseButton: {
    padding: 4,
    flexShrink: 0,
  },
  columnTitleCollapsed: {
    fontSize: "0.8125rem",
    lineHeight: 1.25,
    wordBreak: "break-word",
  },
  columnTitle: {
    fontWeight: 700,
    fontSize: "0.9375rem",
    letterSpacing: "0.02em",
  },
  countChip: {
    fontWeight: 700,
    minWidth: 28,
    height: 26,
  },
  columnHeaderClosedActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexShrink: 0,
  },
  closedPeriodSelect: {
    minWidth: 108,
    maxWidth: 140,
    flexShrink: 0,
    "& .MuiOutlinedInput-root": {
      fontSize: "0.75rem",
    },
    "& .MuiSelect-select": {
      paddingTop: 6,
      paddingBottom: 6,
    },
  },
  columnBody: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: theme.spacing(1.5),
    minHeight: 140,
    ...theme.scrollbarStyles,
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.02)",
  },
  columnBodyCollapsed: {
    flex: 1,
    minHeight: 72,
    padding: theme.spacing(0.75),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.02)",
  },
  collapsedDropHint: {
    fontSize: "0.6875rem",
    textAlign: "center",
    color: theme.palette.text.secondary,
    lineHeight: 1.3,
    padding: theme.spacing(0, 0.5),
  },
  columnLoadMore: {
    flexShrink: 0,
    padding: theme.spacing(1, 1.5, 1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: theme.spacing(0.75),
    backgroundColor: theme.palette.background.paper,
  },
  showingCountText: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    textAlign: "center",
  },
  card: {
    backgroundColor: theme.palette.background.paper,
    borderRadius: 10,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
    cursor: "grab",
    border: `1px solid ${theme.palette.divider}`,
    borderLeftWidth: 4,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    transition:
      "box-shadow 0.2s ease, transform 0.15s ease, border-color 0.15s ease, opacity 0.12s ease",
    "&:hover": {
      boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
      transform: "translateY(-1px)",
    },
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  cardDragging: {
    opacity: 0.5,
    cursor: "grabbing",
    transform: "scale(0.98)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  },
  cardAccentPending: {
    borderLeftColor: theme.palette.warning.main,
  },
  cardAccentOpen: {
    borderLeftColor: theme.palette.primary.main,
  },
  cardAccentClosed: {
    borderLeftColor: theme.palette.grey[500],
  },
  cardTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.75),
  },
  cardTopRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: theme.spacing(0.5),
    flexShrink: 0,
    maxWidth: "48%",
  },
  cardTopActions: {
    display: "flex",
    justifyContent: "flex-end",
    width: "100%",
  },
  cardChipsRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: theme.spacing(0.5),
  },
  unreadChip: {
    height: 22,
    fontWeight: 700,
  },
  contactName: {
    fontWeight: 700,
    fontSize: "0.9375rem",
    lineHeight: 1.3,
    flex: 1,
    minWidth: 0,
    wordBreak: "break-word",
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(1),
  },
  chipQueue: {
    maxWidth: "100%",
    height: 24,
    "& .MuiChip-label": {
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
  chipUser: {
    maxWidth: "100%",
    height: 24,
    "& .MuiChip-label": {
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
  statusChip: {
    height: 22,
    fontSize: "0.6875rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  lastMessage: {
    fontSize: "0.8125rem",
    lineHeight: 1.45,
    color: theme.palette.text.secondary,
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  timeRow: {
    marginTop: theme.spacing(0.75),
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
  },
  emptyHint: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: theme.spacing(3, 2),
    minHeight: 160,
    color: theme.palette.text.secondary,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing(1),
    opacity: 0.35,
  },
  skeletonBoard: {
    display: "flex",
    gap: theme.spacing(2),
    flex: 1,
    minHeight: 400,
    overflowX: "auto",
  },
  skeletonColumn: {
    flex: "1 1 280px",
    minWidth: 260,
    maxWidth: 400,
    borderRadius: 12,
    padding: theme.spacing(1.5),
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
  },
  noQueuesPaper: {
    padding: theme.spacing(4),
    textAlign: "center",
    borderRadius: 12,
    border: `1px dashed ${theme.palette.divider}`,
  },
}));

function columnAccentClass(classes, statusKey) {
  if (statusKey === "pending") return classes.cardAccentPending;
  if (statusKey === "open") return classes.cardAccentOpen;
  return classes.cardAccentClosed;
}

function statusChipColor(statusKey, theme) {
  if (statusKey === "pending") return { borderColor: theme.palette.warning.main, color: theme.palette.warning.dark };
  if (statusKey === "open") return { borderColor: theme.palette.primary.main, color: theme.palette.primary.main };
  return { borderColor: theme.palette.grey[500], color: theme.palette.grey[700] };
}

function KanbanBoardSkeleton({ classes }) {
  return (
    <div className={classes.skeletonBoard} aria-busy="true" aria-label={i18n.t("kanban.loading")}>
      {[1, 2, 3].map((col) => (
        <div key={col} className={classes.skeletonColumn}>
          <Skeleton variant="rect" height={40} style={{ borderRadius: 8, marginBottom: 12 }} />
          {[1, 2, 3].map((row) => (
            <Box key={row} mb={1.5}>
              <Skeleton variant="text" width="70%" height={22} />
              <Skeleton variant="text" width="100%" height={16} />
              <Skeleton variant="text" width="90%" height={16} />
              <Skeleton variant="rect" height={56} style={{ borderRadius: 8, marginTop: 8 }} />
            </Box>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Atualiza só o status (PUT existente). queueId/userId/contact permanecem no servidor.
 */
export async function applyKanbanStatusChange(ticketId, newStatus) {
  if (ticketId == null || !newStatus) return;
  await api.put(`/tickets/${ticketId}`, { status: newStatus });
}

const Kanban = () => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);
  const { whatsApps } = useContext(WhatsAppsContext);
  const { users: usersList } = useUsers();
  const { profile, queues } = user;
  const queuesList = Array.isArray(queues) ? queues : [];
  const isAdmin = String(profile || "").toLowerCase() === "admin";

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [draggingTicketId, setDraggingTicketId] = useState(null);
  const ignoreCardClickUntilRef = useRef(0);

  const [filterUser, setFilterUser] = useState("");
  const [filterSetor, setFilterSetor] = useState("");
  const [filterConexao, setFilterConexao] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [closedPeriod, setClosedPeriod] = useState(() =>
    readKanbanClosedPeriodFromStorage()
  );
  const [collapsedColumns, setCollapsedColumns] = useState(() =>
    getInitialKanbanCollapsedColumns()
  );
  const [visibleLimits, setVisibleLimits] = useState(() =>
    getInitialKanbanVisibleLimits()
  );
  const collapsedDefaultsAppliedRef = useRef(false);
  const columnScrollLoadAtRef = useRef({});

  const handleClosedPeriodChange = useCallback((e) => {
    const next = e.target.value;
    setClosedPeriod(next);
    writeKanbanClosedPeriodToStorage(next);
  }, []);

  const queueIdsParam = useMemo(
    () =>
      queuesList.length
        ? filterSetor
          ? [Number(filterSetor)]
          : queuesList.map((q) => q.id)
        : [],
    [filterSetor, queuesList]
  );
  const usersParam = useMemo(
    () => (filterUser ? [Number(filterUser)] : []),
    [filterUser]
  );

  const fetchTickets = useCallback(async () => {
    if (!isAdmin && queuesList.length === 0) {
      setTickets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get(getApiUrl("/ticket/kanban"), {
        params: {
          queueIds: JSON.stringify(queueIdsParam),
          showAll: isAdmin ? "true" : "false",
          users: JSON.stringify(usersParam),
          closedPeriod,
          ...(filterStatus ? { status: filterStatus } : {}),
        },
      });
      let list = Array.isArray(data.tickets) ? data.tickets : [];
      if (filterConexao) {
        list = list.filter((t) => String(t.whatsappId) === String(filterConexao));
      }
      if (filterUser) {
        list = list.filter((t) => String(t.userId || "") === String(filterUser));
      }
      if (filterSetor) {
        list = list.filter((t) => String(t.queueId || "") === String(filterSetor));
      }
      if (filterStatus) {
        list = list.filter((t) => t.status === filterStatus);
      }
      setTickets(list);
    } catch (err) {
      console.error(err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [
    filterConexao,
    filterSetor,
    filterStatus,
    filterUser,
    isAdmin,
    queueIdsParam,
    queuesList.length,
    usersParam,
    closedPeriod,
  ]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    setVisibleLimits((prev) => ({ ...prev, closed: KANBAN_COLUMN_PAGE_SIZE }));
  }, [closedPeriod]);

  useEffect(() => {
    setVisibleLimits(getInitialKanbanVisibleLimits());
  }, [filterUser, filterSetor, filterConexao, filterStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, KANBAN_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setVisibleLimits(getInitialKanbanVisibleLimits());
  }, [debouncedSearch]);

  useEffect(() => {
    const end = () => {
      setDragOverColumn(null);
      setDraggingTicketId(null);
    };
    window.addEventListener("dragend", end);
    return () => window.removeEventListener("dragend", end);
  }, []);

  const ticketMatchesUiFilters = useCallback(
    (t) => {
      if (filterConexao && String(t.whatsappId) !== String(filterConexao)) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterUser && String(t.userId || "") !== String(filterUser)) return false;
      if (filterSetor && String(t.queueId || "") !== String(filterSetor)) return false;
      if (!ticketMatchesKanbanClosedPeriod(t, closedPeriod)) return false;
      // Admin vê todas as filas da empresa na API (showAll); não restringir às filas do perfil do usuário.
      // Usuário comum: filas em queueIdsParam; exceção — ticket atribuído diretamente a si.
      if (
        !isAdmin &&
        queueIdsParam.length &&
        t.queueId &&
        !queueIdsParam.includes(Number(t.queueId)) &&
        String(t.userId || "") !== String(user?.id || "")
      ) {
        return false;
      }
      return true;
    },
    [
      filterConexao,
      filterSetor,
      filterStatus,
      filterUser,
      queueIdsParam,
      isAdmin,
      user?.id,
      closedPeriod,
    ]
  );

  useEffect(() => {
    const companyId = user?.companyId;
    if (!companyId) return undefined;

    const socket = socketManager.getSocket(companyId);

    const onTicket = (data) => {
      if (data.action === "delete" && data.ticketId) {
        setTickets((prev) => prev.filter((t) => t.id !== data.ticketId));
        return;
      }
      if (data.action === "updateUnread" && data.ticketId) {
        setTickets((prev) =>
          prev.map((t) => (t.id === data.ticketId ? { ...t, unreadMessages: 0 } : t))
        );
        return;
      }
      if (data.action === "update" && data.ticket) {
        const ticket = data.ticket;
        setTickets((prev) => {
          const idx = prev.findIndex((x) => x.id === ticket.id);
          if (!ticketMatchesUiFilters(ticket)) {
            if (idx === -1) return prev;
            return prev.filter((x) => x.id !== ticket.id);
          }
          if (idx === -1) return [ticket, ...prev];
          const merged = { ...prev[idx], ...ticket };
          return prev.map((x, i) => (i === idx ? merged : x));
        });
      }
    };

    const onAppMessage = (data) => {
      if (data.action === "create" && data.ticket) {
        const ticket = data.ticket;
        setTickets((prev) => {
          const idx = prev.findIndex((x) => x.id === ticket.id);
          if (!ticketMatchesUiFilters(ticket)) {
            if (idx === -1) return prev;
            return prev.filter((x) => x.id !== ticket.id);
          }
          if (idx === -1) return [ticket, ...prev];
          const merged = { ...prev[idx], ...ticket };
          return prev.map((x, i) => (i === idx ? merged : x));
        });
      }
    };

    socket.on("ready", () => {
      socket.emit("joinNotification");
    });

    socket.on(`company-${companyId}-ticket`, onTicket);
    socket.on(`company-${companyId}-appMessage`, onAppMessage);

    return () => {
      socket.off(`company-${companyId}-ticket`, onTicket);
      socket.off(`company-${companyId}-appMessage`, onAppMessage);
    };
  }, [socketManager, user?.companyId, ticketMatchesUiFilters]);

  const toggleColumnCollapsed = useCallback((columnKey) => {
    setCollapsedColumns((prev) => {
      const next = { ...prev, [columnKey]: !prev[columnKey] };
      writeKanbanCollapsedColumnsToStorage(next);
      return next;
    });
  }, []);

  const columnsByStatus = useMemo(() => {
    const buckets = emptyColumns();
    tickets.forEach((t) => {
      const k = t.status;
      if (k === "pending" || k === "open" || k === "closed") {
        buckets[k].push(t);
      }
    });
    return buckets;
  }, [tickets]);

  const searchActive = debouncedSearch.length > 0;

  const columnsAfterSearch = useMemo(
    () => ({
      pending: filterTicketsByKanbanSearch(columnsByStatus.pending, debouncedSearch),
      open: filterTicketsByKanbanSearch(columnsByStatus.open, debouncedSearch),
      closed: filterTicketsByKanbanSearch(columnsByStatus.closed, debouncedSearch),
    }),
    [columnsByStatus, debouncedSearch]
  );

  const loadMoreColumn = useCallback(
    (columnKey) => {
      setVisibleLimits((prev) => {
        const total = columnsAfterSearch[columnKey]?.length ?? 0;
        const nextLimit = nextVisibleLimit(prev[columnKey], total);
        if (nextLimit === prev[columnKey]) return prev;
        return { ...prev, [columnKey]: nextLimit };
      });
    },
    [columnsAfterSearch]
  );

  const handleColumnScroll = useCallback(
    (columnKey) => (e) => {
      const el = e.currentTarget;
      if (!el) return;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
      if (!nearBottom) return;

      const now = Date.now();
      const last = columnScrollLoadAtRef.current[columnKey] || 0;
      if (now - last < 450) return;

      const total = columnsAfterSearch[columnKey]?.length ?? 0;
      const current = visibleLimits[columnKey] ?? KANBAN_COLUMN_PAGE_SIZE;
      if (current >= total) return;

      columnScrollLoadAtRef.current[columnKey] = now;
      loadMoreColumn(columnKey);
    },
    [columnsAfterSearch, visibleLimits, loadMoreColumn]
  );

  useEffect(() => {
    if (hasKanbanCollapsedColumnsPreference()) return;
    if (collapsedDefaultsAppliedRef.current || loading) return;
    collapsedDefaultsAppliedRef.current = true;
    if (shouldDefaultCollapseClosedColumn(columnsByStatus.closed.length)) {
      setCollapsedColumns((prev) => ({ ...prev, closed: true }));
    }
  }, [loading, columnsByStatus.closed.length]);

  const handleDropOnColumn = useCallback(
    async (e, targetStatus) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverColumn(null);

      const raw = e.dataTransfer.getData("application/x-kanban-ticket-id");
      const ticketId = raw ? Number(raw) : NaN;
      if (!Number.isFinite(ticketId)) return;

      const current = tickets.find((t) => t.id === ticketId);
      if (!current || current.status === targetStatus) return;

      const snapshot = tickets;
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: targetStatus } : t))
      );

      try {
        await applyKanbanStatusChange(ticketId, targetStatus);
      } catch (err) {
        setTickets(snapshot);
        toastError(err);
      }
    },
    [tickets]
  );

  const goToTicket = (ticket) => {
    if (Date.now() < ignoreCardClickUntilRef.current) return;
    if (ticket?.uuid) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleTicketUpdatedFromQuickAction = useCallback(
    (updated) => {
      if (!updated?.id) return;
      setTickets((prev) => {
        const idx = prev.findIndex((t) => t.id === updated.id);
        if (idx === -1) return prev;
        const merged = { ...prev[idx], ...updated };
        if (!ticketMatchesUiFilters(merged)) {
          return prev.filter((t) => t.id !== updated.id);
        }
        return prev.map((t, i) => (i === idx ? merged : t));
      });
    },
    [ticketMatchesUiFilters]
  );

  return (
    <div className={classes.root}>
      <Paper elevation={0} className={classes.filterBar}>
        <FormControl variant="outlined" size="small" className={classes.filterControl}>
          <InputLabel id="kanban-filter-user">Usuário</InputLabel>
          <Select
            labelId="kanban-filter-user"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            label="Usuário"
          >
            <MenuItem value="">Todos</MenuItem>
            {(usersList || []).map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                {u.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" className={classes.filterControl}>
          <InputLabel id="kanban-filter-setor">Setor</InputLabel>
          <Select
            labelId="kanban-filter-setor"
            value={filterSetor}
            onChange={(e) => setFilterSetor(e.target.value)}
            label="Setor"
          >
            <MenuItem value="">Todos</MenuItem>
            {(queues || []).map((q) => (
              <MenuItem key={q.id} value={String(q.id)}>
                {q.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" className={classes.filterControl}>
          <InputLabel id="kanban-filter-conexao">Conexão</InputLabel>
          <Select
            labelId="kanban-filter-conexao"
            value={filterConexao}
            onChange={(e) => setFilterConexao(e.target.value)}
            label="Conexão"
          >
            <MenuItem value="">Todas</MenuItem>
            {(Array.isArray(whatsApps) ? whatsApps : []).map((w) => (
              <MenuItem key={w.id} value={String(w.id)}>
                {w.name || `Conexão ${w.id}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" className={classes.filterControl}>
          <InputLabel id="kanban-filter-status">Status</InputLabel>
          <Select
            labelId="kanban-filter-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            label="Status"
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="pending">Pendente</MenuItem>
            <MenuItem value="open">Em aberto</MenuItem>
            <MenuItem value="closed">Finalizado</MenuItem>
          </Select>
        </FormControl>
        <TextField
          className={clsx(classes.filterControl, classes.searchControl, classes.searchField)}
          variant="outlined"
          size="small"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={i18n.t("kanban.searchPlaceholder")}
          inputProps={{ "aria-label": i18n.t("kanban.searchPlaceholder") }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
            endAdornment: searchInput ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  aria-label={i18n.t("kanban.searchClear")}
                  onClick={() => setSearchInput("")}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      </Paper>
      {searchActive ? (
        <Typography className={classes.filteringHint} component="p">
          {i18n.t("kanban.filteringBy", { term: debouncedSearch })}
        </Typography>
      ) : null}

      {!isAdmin && queuesList.length === 0 ? (
        <Paper className={classes.noQueuesPaper} elevation={0}>
          <Typography color="textSecondary">{i18n.t("kanban.noQueuesHint")}</Typography>
        </Paper>
      ) : loading ? (
        <KanbanBoardSkeleton classes={classes} />
      ) : (
        <div className={classes.boardRow}>
          {COLUMN_ORDER.map((col) => {
            const totalInColumn = columnsByStatus[col.key].length;
            const filteredList = columnsAfterSearch[col.key];
            const columnVisible = getColumnVisibleMeta(
              filteredList,
              visibleLimits[col.key]
            );
            const visibleTickets = columnVisible.visibleTickets;
            const isCollapsed = Boolean(collapsedColumns[col.key]);
            const countChipLabel =
              searchActive && filteredList.length !== totalInColumn
                ? i18n.t("kanban.countFiltered", {
                    filtered: filteredList.length,
                    total: totalInColumn,
                  })
                : String(totalInColumn);
            const isDropTarget = dragOverColumn === col.key;
            const headerAccent =
              col.accent === "pending"
                ? theme.palette.warning.main
                : col.accent === "open"
                  ? theme.palette.primary.main
                  : theme.palette.grey[600];
            const countChipStyle =
              col.accent === "pending"
                ? {
                    backgroundColor: theme.palette.warning.light,
                    color: theme.palette.getContrastText(theme.palette.warning.light),
                  }
                : col.accent === "closed"
                  ? {
                      backgroundColor:
                        theme.palette.type === "dark"
                          ? theme.palette.grey[700]
                          : theme.palette.grey[300],
                      color: theme.palette.getContrastText(
                        theme.palette.type === "dark"
                          ? theme.palette.grey[700]
                          : theme.palette.grey[300]
                      ),
                    }
                  : undefined;

            const countChip = (
              <Chip
                size="small"
                label={countChipLabel}
                className={classes.countChip}
                color={col.accent === "open" ? "primary" : "default"}
                style={countChipStyle}
                title={
                  searchActive
                    ? i18n.t("kanban.countFiltered", {
                        filtered: filteredList.length,
                        total: totalInColumn,
                      })
                    : undefined
                }
              />
            );

            const collapseControl = (
              <Tooltip
                title={
                  isCollapsed
                    ? i18n.t("kanban.expandColumn")
                    : i18n.t("kanban.collapseColumn")
                }
              >
                <IconButton
                  size="small"
                  className={classes.collapseButton}
                  aria-label={
                    isCollapsed
                      ? i18n.t("kanban.expandColumn")
                      : i18n.t("kanban.collapseColumn")
                  }
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleColumnCollapsed(col.key)}
                >
                  {isCollapsed ? (
                    <ChevronRightIcon fontSize="small" />
                  ) : (
                    <ExpandMoreIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            );

            return (
              <div
                key={col.key}
                className={clsx(
                  classes.column,
                  isCollapsed && classes.columnCollapsed,
                  isDropTarget && classes.columnDropActive
                )}
              >
                <Box
                  className={clsx(
                    classes.columnHeader,
                    isCollapsed && classes.columnHeaderCollapsed
                  )}
                  borderLeft={`4px solid ${headerAccent}`}
                  bgcolor="background.paper"
                >
                  {isCollapsed ? (
                    <>
                      <Box className={classes.columnHeaderMain}>
                        {collapseControl}
                        <Typography
                          className={clsx(classes.columnTitle, classes.columnTitleCollapsed)}
                          component="h2"
                          color="textPrimary"
                        >
                          {i18n.t(col.labelKey)}
                        </Typography>
                      </Box>
                      {countChip}
                    </>
                  ) : col.key === "closed" ? (
                    <>
                      <Box className={classes.columnHeaderMain}>
                        {collapseControl}
                        <Typography
                          className={classes.columnTitle}
                          component="h2"
                          color="textPrimary"
                        >
                          {i18n.t(col.labelKey)}
                        </Typography>
                      </Box>
                      <Box className={classes.columnHeaderClosedActions}>
                        {countChip}
                        <FormControl
                          variant="outlined"
                          size="small"
                          className={classes.closedPeriodSelect}
                        >
                          <Select
                            value={closedPeriod}
                            onChange={handleClosedPeriodChange}
                            displayEmpty
                            inputProps={{
                              "aria-label": i18n.t("kanban.closedPeriod.label"),
                            }}
                          >
                            {KANBAN_CLOSED_PERIOD_OPTIONS.map((opt) => (
                              <MenuItem key={opt} value={opt} dense>
                                {i18n.t(`kanban.closedPeriod.${opt}`)}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Box className={classes.columnHeaderMain}>
                        {collapseControl}
                        <Typography
                          className={classes.columnTitle}
                          component="h2"
                          color="textPrimary"
                        >
                          {i18n.t(col.labelKey)}
                        </Typography>
                      </Box>
                      {countChip}
                    </>
                  )}
                </Box>
                <div
                  className={isCollapsed ? classes.columnBodyCollapsed : classes.columnBody}
                  onScroll={isCollapsed ? undefined : handleColumnScroll(col.key)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverColumn(col.key);
                  }}
                  onDrop={(e) => handleDropOnColumn(e, col.key)}
                >
                  {isCollapsed ? (
                    <Typography className={classes.collapsedDropHint} component="p">
                      {i18n.t("kanban.collapsedDropHint")}
                    </Typography>
                  ) : filteredList.length === 0 ? (
                    <div className={classes.emptyHint}>
                      <InboxOutlinedIcon className={classes.emptyIcon} />
                      <Typography variant="subtitle2" gutterBottom>
                        {searchActive && totalInColumn > 0
                          ? i18n.t("kanban.searchEmptyColumn")
                          : i18n.t("kanban.emptyColumnTitle")}
                      </Typography>
                      {!searchActive || totalInColumn === 0 ? (
                        <Typography variant="body2" color="textSecondary">
                          {i18n.t("kanban.emptyColumnHint")}
                        </Typography>
                      ) : null}
                    </div>
                  ) : (
                    visibleTickets.map((ticket) => {
                      const sk = ticket.status;
                      const queueColor = ticket.queue?.color;

                      return (
                        <Paper
                          key={ticket.id}
                          className={clsx(
                            classes.card,
                            columnAccentClass(classes, sk),
                            draggingTicketId === ticket.id && classes.cardDragging
                          )}
                          elevation={0}
                          draggable
                          onDragStart={(e) => {
                            setDraggingTicketId(ticket.id);
                            e.dataTransfer.setData("application/x-kanban-ticket-id", String(ticket.id));
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDraggingTicketId(null);
                            ignoreCardClickUntilRef.current = Date.now() + 350;
                          }}
                          onClick={() => goToTicket(ticket)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") goToTicket(ticket);
                          }}
                        >
                          <div className={classes.cardTop}>
                            <Typography className={classes.contactName} component="div" color="textPrimary">
                              {ticket.contact?.name || ticket.contact?.number || `#${ticket.id}`}
                            </Typography>
                            <div className={classes.cardTopRight}>
                              <div className={classes.cardTopActions}>
                                <KanbanTicketQuickMenu
                                  ticket={ticket}
                                  authUser={user}
                                  usersList={usersList}
                                  queuesList={Array.isArray(queues) ? queues : []}
                                  onTicketUpdated={handleTicketUpdatedFromQuickAction}
                                  canTransfer={isAdmin || queuesList.length > 0}
                                />
                              </div>
                              <div className={classes.cardChipsRow}>
                                {ticket.unreadMessages > 0 ? (
                                  <Chip
                                    size="small"
                                    color="secondary"
                                    label={`${ticket.unreadMessages} ${i18n.t("kanban.unread")}`}
                                    className={classes.unreadChip}
                                  />
                                ) : null}
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={i18n.t(`kanban.column.${sk}`)}
                                  className={classes.statusChip}
                                  style={statusChipColor(sk, theme)}
                                />
                              </div>
                            </div>
                          </div>
                          <Typography className={classes.lastMessage} component="p">
                            {truncateText(ticket.lastMessage)}
                          </Typography>
                          <Typography className={classes.timeRow} component="p">
                            {i18n.t("kanban.lastInteraction")}:{" "}
                            {ticket.updatedAt
                              ? formatDistanceToNow(new Date(ticket.updatedAt), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })
                              : "—"}
                          </Typography>
                          <div className={classes.metaRow}>
                            <Chip
                              size="small"
                              label={ticket.queue?.name || "—"}
                              className={classes.chipQueue}
                              variant="outlined"
                              style={
                                queueColor
                                  ? {
                                      borderColor: queueColor,
                                      backgroundColor: `${queueColor}22`,
                                    }
                                  : undefined
                              }
                            />
                            <Chip
                              size="small"
                              label={ticket.user?.name || "—"}
                              className={classes.chipUser}
                              variant="outlined"
                              color={ticket.user ? "primary" : "default"}
                            />
                          </div>
                        </Paper>
                      );
                    })
                  )}
                </div>
                {!isCollapsed && columnVisible.hasMore ? (
                  <Box className={classes.columnLoadMore}>
                    <Typography className={classes.showingCountText} component="p">
                      {i18n.t("kanban.showingCount", {
                        visible: columnVisible.visibleCount,
                        total: columnVisible.total,
                      })}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      fullWidth
                      onClick={() => loadMoreColumn(col.key)}
                    >
                      {i18n.t("kanban.loadMore")}
                    </Button>
                  </Box>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Kanban;
