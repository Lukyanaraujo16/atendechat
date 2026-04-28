import React, { useState, useEffect, useCallback, useContext, useMemo, useRef } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { momentLocalizer } from "react-big-calendar";
import moment from "moment-timezone";
import "moment/locale/pt-br";
import "moment/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { toast } from "react-toastify";

import { makeStyles, useTheme, alpha } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import AddIcon from "@material-ui/icons/Add";
import CalendarTodayOutlinedIcon from "@material-ui/icons/CalendarTodayOutlined";
import ViewListIcon from "@material-ui/icons/ViewList";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import { isArray } from "lodash";
import ConfirmationModal from "../../components/ConfirmationModal";

import AgendaCalendarDnD from "./AgendaCalendarDnD";
import AgendaCalendarToolbar from "./AgendaCalendarToolbar";
import AgendaCalendarEvent from "./AgendaCalendarEvent";
import AgendaListView from "./AgendaListView";
import AgendaEventModal from "./AgendaEventModal";
import AgendaFilters from "./AgendaFilters";
import AgendaStats from "./AgendaStats";
import {
  canEditAppointment,
  QUICK_FILTERS,
  applyQuickFilter,
  matchesSearchText,
  groupAppointmentsByStartDay,
  countOverlappingToday,
  normalizeReactBigCalendarFetchRange,
  toCalendarEventsForRbc,
  appointmentOverlapsRange,
  normalizeHexColor,
} from "./agendaUtils";
import {
  resolveAgendaTimezone,
  wallDateTimeToUtcIso,
  wallDateStartToUtcIso,
  wallDateEndToUtcIso,
  utcIsoToDatetimeLocal,
  rbcInteractionToApiUtc,
} from "./agendaTimezone";
import {
  AGENDA_SNAP_MINUTES,
  snapDatetimeLocalPair,
  snapInteractionDates,
  snapOpenNewMoments,
} from "./agendaSnap";

const localizer = momentLocalizer(moment);

const isElevated = (profile) => profile === "admin" || profile === "supervisor";

function isTypingInField(target) {
  if (!target || !target.tagName) return false;
  const t = String(target.tagName).toLowerCase();
  if (t === "input" || t === "textarea" || t === "select") return true;
  if (target.isContentEditable) return true;
  if (typeof target.closest === "function" && target.closest('[contenteditable="true"]')) {
    return true;
  }
  return false;
}

const useStyles = makeStyles((theme) => ({
  root: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
  pageCard: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    backgroundColor: theme.palette.background.paper,
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 4px 24px rgba(0,0,0,0.35)"
        : "0 4px 24px rgba(0,0,0,0.06)",
  },
  pageCardHeader: {
    padding: theme.spacing(2, 2, 1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(2),
    justifyContent: "space-between",
  },
  legend: {
    display: "flex",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    alignItems: "center",
    padding: theme.spacing(0, 2, 1.5),
  },
  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    marginRight: theme.spacing(0.75),
    flexShrink: 0,
  },
  calendarShell: {
    position: "relative",
    flex: 1,
    minHeight: 560,
    padding: theme.spacing(0, 0, 1, 0),
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.background.paper, 0.5)
        : theme.palette.background.default,
    "& .rbc-calendar": {
      fontFamily: theme.typography.fontFamily,
      color: theme.palette.text.primary,
      minHeight: 520,
    },
    "& .rbc-header": {
      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.55)}`,
      color: theme.palette.text.secondary,
      fontWeight: 600,
      fontSize: "0.72rem",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      padding: theme.spacing(0.75, 0),
      backgroundColor: "transparent",
    },
    "& .rbc-today": {
      backgroundColor:
        theme.palette.type === "dark"
          ? alpha(theme.palette.primary.main, 0.12)
          : alpha(theme.palette.primary.main, 0.06),
      boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, theme.palette.type === "dark" ? 0.35 : 0.25)}`,
    },
    "& .rbc-off-range-bg": {
      background: alpha(theme.palette.action.hover, theme.palette.type === "dark" ? 0.35 : 0.5),
    },
    "& .rbc-month-view, & .rbc-time-view, & .rbc-day-view": {
      borderColor: alpha(theme.palette.divider, 0.65),
      borderRadius: theme.shape.borderRadius,
      overflow: "hidden",
    },
    "& .rbc-day-bg + .rbc-day-bg, & .rbc-month-row + .rbc-month-row": {
      borderColor: alpha(theme.palette.divider, 0.45),
    },
    "& .rbc-time-slot": {
      borderColor: alpha(theme.palette.divider, 0.35),
    },
    "& .rbc-time-header-content": {
      borderColor: alpha(theme.palette.divider, 0.55),
    },
    "& .rbc-time-content": {
      borderTop: `1px solid ${alpha(theme.palette.divider, 0.45)}`,
    },
    "& .rbc-day-slot .rbc-time-slot": {
      borderColor: alpha(theme.palette.divider, 0.25),
    },
    "& .rbc-current-time-indicator": {
      backgroundColor: theme.palette.error.main,
      height: 2,
    },
    "& .rbc-show-more": {
      color: theme.palette.primary.main,
      fontWeight: 600,
      fontSize: "0.72rem",
    },
    "& .rbc-addons-dnd-drag-preview": {
      opacity: 0.93,
      filter: theme.palette.type === "dark" ? "brightness(1.08)" : "none",
      outline: `2px dashed ${alpha(theme.palette.primary.main, 0.95)}`,
      outlineOffset: 1,
      borderRadius: 8,
      boxShadow:
        theme.palette.type === "dark"
          ? "0 4px 18px rgba(0,0,0,0.55)"
          : "0 4px 14px rgba(60,64,67,0.35)",
    },
    "& .rbc-addons-dnd-is-dragging .rbc-event:not(.rbc-addons-dnd-drag-preview)": {
      opacity: 0.42,
    },
    "& .rbc-addons-dnd-over": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(138, 180, 248, 0.26)"
          : "rgba(26, 115, 232, 0.16)",
      boxShadow: `inset 0 0 0 2px ${alpha(theme.palette.primary.main, 0.35)}`,
    },
    "& .rbc-event": {
      padding: 0,
      border: "none",
      backgroundColor: "transparent",
      boxShadow: "none",
    },
    "& .rbc-event-label": {
      fontSize: "0.65rem",
    },
    "& .rbc-event-content": {
      height: "100%",
    },
    "& .rbc-month-row": {
      borderColor: alpha(theme.palette.divider, 0.45),
    },
    "& .rbc-date-cell": {
      padding: theme.spacing(0.25, 0.5),
    },
  },
  loadingOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.72)",
    backdropFilter: "blur(2px)",
  },
  periodHint: {
    padding: theme.spacing(0, 2, 1),
    color: theme.palette.text.secondary,
    fontSize: "0.8125rem",
  },
  toggle: {
    borderRadius: theme.shape.borderRadius,
  },
  errorBanner: {
    margin: theme.spacing(0, 2, 1),
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.error.dark + "22",
    border: `1px solid ${theme.palette.error.main}44`,
    color: theme.palette.error.main,
  },
}));

const Agenda = () => {
  const classes = useStyles();
  const theme = useTheme();
  const location = useLocation();
  const history = useHistory();
  const openedFromUrlRef = useRef(false);
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);
  const elevated = isElevated(user?.profile);

  const [appointmentsRaw, setAppointmentsRaw] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [users, setUsers] = useState([]);
  const [range, setRange] = useState(null);
  const [viewMode, setViewMode] = useState("calendar");
  const [calendarView, setCalendarView] = useState("month");
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  const [open, setOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [responding, setResponding] = useState(false);
  const [quickFilter, setQuickFilter] = useState(QUICK_FILTERS.ALL);
  const [searchQuery, setSearchQuery] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    startAt: "",
    endAt: "",
    allDay: false,
    isCollective: false,
    visibility: "private",
    participantUserIds: [],
    color: "",
  });

  const lang = i18n.language || "pt";
  const localeForFormat = lang.startsWith("en") ? "en" : lang.startsWith("es") ? "es" : "pt";

  const agendaTz = useMemo(() => resolveAgendaTimezone(user), [user]);

  useEffect(() => {
    moment.tz.setDefault(agendaTz);
    return () => {
      moment.tz.setDefault();
    };
  }, [agendaTz]);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get("/users/list");
      const u = isArray(data) ? data : [];
      setUsers(u.filter((x) => x && Number(x.id) !== Number(user?.id)));
    } catch (e) {
      toastError(e);
    }
  }, [user?.id]);

  const fetchEvents = useCallback(
    async (start, end) => {
      if (!user?.companyId) return;
      setLoading(true);
      setLoadError(false);
      try {
        const { data } = await api.get("/appointments", {
          params: {
            start: start.toISOString(),
            end: end.toISOString(),
          },
        });
        const list = isArray(data) ? data : [];
        setAppointmentsRaw(list);
      } catch (e) {
        toastError(e);
        setAppointmentsRaw([]);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    [user?.companyId, user?.id]
  );

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (lang.startsWith("en")) moment.locale("en");
    else if (lang.startsWith("es")) moment.locale("es");
    else moment.locale("pt-br");
  }, [lang]);

  const onRangeChange = useCallback(
    (rangeInput) => {
      const normalized = normalizeReactBigCalendarFetchRange(rangeInput, agendaTz);
      if (!normalized) return;
      setRange(normalized);
      fetchEvents(normalized.start, normalized.end);
    },
    [fetchEvents, agendaTz]
  );

  useEffect(() => {
    if (!user?.companyId) return;
    const start = moment.tz(agendaTz).startOf("month").toDate();
    const end = moment.tz(agendaTz).endOf("month").toDate();
    setRange({ start, end });
    fetchEvents(start, end);
  }, [user?.companyId, agendaTz, fetchEvents]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    if (!companyId) return;
    const socket = socketManager.getSocket(companyId);
    const handler = (data) => {
      if (range?.start && range?.end) fetchEvents(range.start, range.end);
      if (data?.action === "created" && data?.record) {
        const part = (data.record.participants || []).some(
          (p) => Number(p.userId) === Number(user.id)
        );
        if (part) {
          toast.info(i18n.t("agenda.toasts.inviteReceived"));
        }
      }
    };
    socket.on(`company-${companyId}-appointment`, handler);
    return () => {
      socket.off(`company-${companyId}-appointment`, handler);
    };
  }, [socketManager, range, fetchEvents, user.id]);

  const primaryGreen = theme.palette.type === "dark" ? "#81c995" : "#0f9d58";
  const collectiveBlue = theme.palette.type === "dark" ? "#8ab4f8" : "#1a73e8";

  /** Estilo mínimo: o conteúdo visual fica no componente AgendaCalendarEvent. */
  const eventStyleGetter = () => ({
    style: {
      backgroundColor: "transparent",
      border: "none",
      boxShadow: "none",
      padding: 0,
      overflow: "visible",
    },
  });

  const openNew = useCallback(
    (slot) => {
      setEditing(null);
      let startM;
      let endM;
      if (calendarView === "month") {
        const day = moment.tz(slot.start, agendaTz).startOf("day");
        startM = day.clone().hour(9).minute(0).second(0);
        endM = day.clone().hour(10).minute(0).second(0);
      } else {
        startM = moment.tz(slot.start, agendaTz);
        endM = moment.tz(slot.end, agendaTz);
        if (startM.isSame(endM, "minute")) {
          endM = startM.clone().add(1, "hour");
        }
        const snapped = snapOpenNewMoments(startM, endM, AGENDA_SNAP_MINUTES);
        startM = snapped.startM;
        endM = snapped.endM;
      }
      setForm({
        title: "",
        description: "",
        startAt: startM.format("YYYY-MM-DDTHH:mm"),
        endAt: endM.format("YYYY-MM-DDTHH:mm"),
        allDay: false,
        isCollective: false,
        visibility: "private",
        participantUserIds: [],
        color: "",
      });
      setOpen(true);
    },
    [agendaTz, calendarView]
  );

  const openEvent = useCallback(
    (calEventOrRaw) => {
      const a = calEventOrRaw?.resource || calEventOrRaw;
      if (!a) return;
      setEditing(a);
      setForm({
        title: a.title || "",
        description: a.description || "",
        startAt: utcIsoToDatetimeLocal(a.startAt, agendaTz),
        endAt: utcIsoToDatetimeLocal(a.endAt, agendaTz),
        allDay: Boolean(a.allDay),
        isCollective: Boolean(a.isCollective),
        visibility: a.visibility || "private",
        participantUserIds: (a.participants || [])
          .map((p) => p.userId)
          .filter((id) => Number(id) !== Number(user.id)),
        color: normalizeHexColor(a.color) || "",
      });
      setOpen(true);
    },
    [user?.id, agendaTz]
  );

  const openDuplicate = useCallback(
    (a) => {
      if (!a) return;
      const baseTitle = (a.title || "").trim() || i18n.t("agenda.duplicate.untitled");
      setEditing(null);
      setForm({
        title: i18n.t("agenda.duplicate.titlePrefix", { title: baseTitle }),
        description: a.description || "",
        startAt: utcIsoToDatetimeLocal(a.startAt, agendaTz),
        endAt: utcIsoToDatetimeLocal(a.endAt, agendaTz),
        allDay: Boolean(a.allDay),
        isCollective: Boolean(a.isCollective),
        visibility: a.visibility || "private",
        participantUserIds: (a.participants || [])
          .map((p) => p.userId)
          .filter((id) => Number(id) !== Number(user.id)),
        color: normalizeHexColor(a.color) || "",
      });
      setOpen(true);
    },
    [agendaTz, user?.id]
  );

  const eventCanEditDnd = useCallback(
    (calEvent) => {
      const a = calEvent?.resource;
      if (!a) return false;
      return canEditAppointment(a, user?.id, elevated);
    },
    [user?.id, elevated]
  );

  const applyScheduleFromRbcInteraction = useCallback(
    async (info, mode) => {
      const calEvent = info?.event;
      if (!calEvent) return;
      const raw = calEvent.resource;
      if (!raw || !raw.id) return;
      if (!canEditAppointment(raw, user?.id, elevated)) return;

      const allDay =
        info.isAllDay !== undefined && info.isAllDay !== null
          ? Boolean(info.isAllDay)
          : Boolean(calEvent.allDay);

      const snapped = snapInteractionDates(
        { start: info.start, end: info.end, allDay, mode },
        agendaTz,
        AGENDA_SNAP_MINUTES
      );

      const converted = rbcInteractionToApiUtc(
        { start: snapped.start, end: snapped.end, allDay },
        agendaTz
      );
      if (!converted) {
        toast.error(i18n.t("agenda.form.invalidDate"));
        return;
      }

      const id = Number(raw.id);
      const previous = appointmentsRaw.find((a) => Number(a.id) === id);
      if (!previous) return;

      const optimistic = {
        ...previous,
        startAt: converted.startAt,
        endAt: converted.endAt,
        allDay: converted.allDay,
      };

      setAppointmentsRaw((prev) =>
        prev.map((a) => (Number(a.id) === id ? optimistic : a))
      );

      try {
        await api.put(`/appointments/${id}`, {
          startAt: converted.startAt,
          endAt: converted.endAt,
          allDay: converted.allDay,
        });
        const prevSnapshot = {
          startAt: previous.startAt,
          endAt: previous.endAt,
          allDay: Boolean(previous.allDay),
        };
        toast(
          ({ closeToast }) => (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                {i18n.t("agenda.toasts.scheduleUpdated")}
              </span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.put(`/appointments/${id}`, {
                      startAt: prevSnapshot.startAt,
                      endAt: prevSnapshot.endAt,
                      allDay: prevSnapshot.allDay,
                    });
                    setAppointmentsRaw((prev) =>
                      prev.map((a) =>
                        Number(a.id) === id ? { ...previous } : a
                      )
                    );
                    closeToast();
                  } catch (err) {
                    toast.error(i18n.t("agenda.toasts.undoFailed"));
                    toastError(err);
                  }
                }}
                style={{
                  border: "none",
                  borderRadius: 4,
                  padding: "6px 12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.22)",
                  color: "inherit",
                }}
              >
                {i18n.t("agenda.toasts.undo")}
              </button>
            </div>
          ),
          { closeOnClick: false, autoClose: 9000 }
        );
      } catch (e) {
        setAppointmentsRaw((prev) =>
          prev.map((a) => (Number(a.id) === id ? previous : a))
        );
        toastError(e);
      }
    },
    [agendaTz, appointmentsRaw, user?.id, elevated]
  );

  const onEventDrop = useCallback(
    (interaction) => {
      applyScheduleFromRbcInteraction(interaction, "move");
    },
    [applyScheduleFromRbcInteraction]
  );

  const onEventResize = useCallback(
    (interaction) => {
      applyScheduleFromRbcInteraction(interaction, "resize");
    },
    [applyScheduleFromRbcInteraction]
  );

  const onSelectEvent = (calEvent) => {
    openEvent(calEvent);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.get("event")) {
      openedFromUrlRef.current = false;
    }
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("event");
    const id = raw != null ? Number(raw) : NaN;
    if (!Number.isFinite(id) || id < 1) {
      return;
    }
    if (openedFromUrlRef.current) {
      return;
    }
    const a = appointmentsRaw.find((x) => Number(x.id) === id);
    if (!a) {
      return;
    }
    openedFromUrlRef.current = true;
    openEvent(a);
    params.delete("event");
    const next = params.toString();
    history.replace({
      pathname: location.pathname,
      search: next ? `?${next}` : "",
    });
  }, [appointmentsRaw, location.search, location.pathname, history, openEvent]);

  const save = async () => {
    if (!form.title.trim()) {
      toast.error(i18n.t("agenda.form.titleRequired"));
      return;
    }
    const pid = (form.participantUserIds || []).filter(
      (id) => Number(id) !== Number(user.id) && Number(id) > 0
    );
    let startAt;
    let endAt;
    if (form.allDay) {
      const d = (form.startAt || "").split("T")[0];
      startAt = wallDateStartToUtcIso(d, agendaTz);
      endAt = wallDateEndToUtcIso(d, agendaTz);
    } else {
      const snapped = snapDatetimeLocalPair(
        form.startAt,
        form.endAt,
        agendaTz,
        AGENDA_SNAP_MINUTES
      );
      startAt = wallDateTimeToUtcIso(snapped.startStr, agendaTz);
      endAt = wallDateTimeToUtcIso(snapped.endStr, agendaTz);
    }
    if (!startAt || !endAt) {
      toast.error(i18n.t("agenda.form.invalidDate"));
      return;
    }
    const colorPayload = normalizeHexColor(form.color);
    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      startAt,
      endAt,
      allDay: form.allDay,
      isCollective: elevated && form.isCollective,
      visibility: elevated && form.isCollective ? form.visibility : "private",
      participantUserIds: elevated && form.isCollective ? pid : [],
      color: colorPayload,
    };
    if (
      Number.isNaN(new Date(payload.startAt).getTime()) ||
      Number.isNaN(new Date(payload.endAt).getTime())
    ) {
      toast.error(i18n.t("agenda.form.invalidDate"));
      return;
    }
    if (new Date(payload.endAt) <= new Date(payload.startAt)) {
      toast.error(i18n.t("agenda.form.endAfterStart"));
      return;
    }
    if (
      payload.isCollective &&
      payload.visibility === "private" &&
      (!payload.participantUserIds || payload.participantUserIds.length === 0)
    ) {
      toast.error(i18n.t("agenda.form.participantsRequired"));
      return;
    }
    try {
      if (editing?.id) {
        const body = {
          title: payload.title,
          description: payload.description,
          startAt: payload.startAt,
          endAt: payload.endAt,
          allDay: payload.allDay,
          color: colorPayload,
        };
        if (elevated && editing.isCollective) {
          body.participantUserIds = pid;
        }
        await api.put(`/appointments/${editing.id}`, body);
        toast.success(i18n.t("agenda.toasts.updated"));
      } else {
        await api.post("/appointments", payload);
        toast.success(i18n.t("agenda.toasts.created"));
      }
      setOpen(false);
      setEditing(null);
      if (range?.start && range?.end) fetchEvents(range.start, range.end);
    } catch (e) {
      toastError(e);
    }
  };

  const runDelete = async () => {
    const id = deleteTarget?.id || editing?.id;
    if (!id) return;
    try {
      await api.delete(`/appointments/${id}`);
      toast.success(i18n.t("agenda.toasts.deleted"));
      setOpen(false);
      setEditing(null);
      setConfirmDeleteOpen(false);
      setDeleteTarget(null);
      if (range?.start && range?.end) fetchEvents(range.start, range.end);
    } catch (e) {
      toastError(e);
    }
  };

  const requestDeleteFromModal = () => {
    setDeleteTarget(editing);
    setConfirmDeleteOpen(true);
  };

  const requestDeleteFromList = (a) => {
    setDeleteTarget(a);
    setConfirmDeleteOpen(true);
  };

  const handleRespond = async (status) => {
    if (!editing?.id) return;
    setResponding(true);
    try {
      await api.put(`/appointments/${editing.id}/respond`, { status });
      toast.success(i18n.t("agenda.respond.success"));
      if (range?.start && range?.end) fetchEvents(range.start, range.end);
      setOpen(false);
      setEditing(null);
    } catch (e) {
      toastError(e);
    } finally {
      setResponding(false);
    }
  };

  const handleDuplicateFromModal = useCallback(() => {
    if (!editing) return;
    const src = editing;
    setOpen(false);
    setEditing(null);
    openDuplicate(src);
  }, [editing, openDuplicate]);

  useEffect(() => {
    const onKey = (e) => {
      if (isTypingInField(e.target)) return;
      if (e.key === "Escape") {
        if (confirmDeleteOpen) return;
        if (open) {
          setOpen(false);
          setEditing(null);
        }
        return;
      }
      if ((e.key === "n" || e.key === "N") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (open) return;
        if (!user?.companyId) return;
        e.preventDefault();
        const n = moment.tz(agendaTz);
        openNew({ start: n.toDate(), end: n.clone().add(1, "hour").toDate() });
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!open || !editing?.id || confirmDeleteOpen) return;
        if (!canEditAppointment(editing, user?.id, elevated)) return;
        e.preventDefault();
        requestDeleteFromModal();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    open,
    confirmDeleteOpen,
    editing,
    elevated,
    user?.companyId,
    user?.id,
    agendaTz,
    openNew,
  ]);

  const participantOptions = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        label: u.name || u.email || String(u.id),
      })),
    [users]
  );

  const filteredAfterQuick = useMemo(
    () => applyQuickFilter(appointmentsRaw, quickFilter, user?.id, agendaTz),
    [appointmentsRaw, quickFilter, user?.id, agendaTz]
  );

  const filteredAppointments = useMemo(
    () => filteredAfterQuick.filter((a) => matchesSearchText(a, searchQuery)),
    [filteredAfterQuick, searchQuery]
  );

  const filteredEvents = useMemo(
    () => toCalendarEventsForRbc(filteredAppointments, user?.id, agendaTz),
    [filteredAppointments, user?.id, agendaTz]
  );

  const filteredInVisibleRange = useMemo(() => {
    if (!range?.start || !range?.end) return filteredAppointments.length;
    return filteredAppointments.filter((a) =>
      appointmentOverlapsRange(a, range.start, range.end)
    ).length;
  }, [filteredAppointments, range]);

  const listGroups = useMemo(
    () => groupAppointmentsByStartDay(filteredAppointments, agendaTz),
    [filteredAppointments, agendaTz]
  );

  const todayInFiltered = useMemo(
    () => countOverlappingToday(filteredAppointments, agendaTz),
    [filteredAppointments, agendaTz]
  );

  const filtersActive = useMemo(
    () => quickFilter !== QUICK_FILTERS.ALL || !!String(searchQuery).trim(),
    [quickFilter, searchQuery]
  );

  const clearFilters = useCallback(() => {
    setQuickFilter(QUICK_FILTERS.ALL);
    setSearchQuery("");
  }, []);

  const periodLabel =
    range?.start && range?.end
      ? `${moment.tz(range.start, agendaTz).format("LL")} — ${moment
          .tz(range.end, agendaTz)
          .format("LL")}`
      : "";

  const scrollToTime = useMemo(
    () => moment.tz(agendaTz).hour(8).minute(0).second(0).millisecond(0).toDate(),
    [agendaTz]
  );

  const canEditCurrent =
    editing && canEditAppointment(editing, user?.id, elevated);

  if (!user?.companyId) {
    return (
      <MainContainer>
        <Title>{i18n.t("agenda.title")}</Title>
        <p>{i18n.t("agenda.noCompany")}</p>
      </MainContainer>
    );
  }

  return (
    <MainContainer className={classes.root}>
      <MainHeader>
        <Title>{i18n.t("agenda.title")}</Title>
        {viewMode === "list" && (
          <MainHeaderButtonsWrapper>
            <Button
              color="primary"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                const n = moment.tz(agendaTz);
                openNew({ start: n.toDate(), end: n.clone().add(1, "hour").toDate() });
              }}
            >
              {i18n.t("agenda.newEvent")}
            </Button>
          </MainHeaderButtonsWrapper>
        )}
      </MainHeader>

      <Paper className={classes.pageCard} elevation={0}>
        <Box className={classes.pageCardHeader}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
            className={classes.toggle}
          >
            <ToggleButton value="calendar" aria-label="calendar">
              <CalendarTodayOutlinedIcon style={{ marginRight: 8, fontSize: 20 }} />
              {i18n.t("agenda.view.calendar")}
            </ToggleButton>
            <ToggleButton value="list" aria-label="list">
              <ViewListIcon style={{ marginRight: 8, fontSize: 20 }} />
              {i18n.t("agenda.view.list")}
            </ToggleButton>
          </ToggleButtonGroup>
          {periodLabel ? (
            <Typography variant="body2" color="textSecondary">
              {i18n.t("agenda.periodLabel")}: {periodLabel}
            </Typography>
          ) : null}
        </Box>

        <Box className={classes.legend}>
          <span className={classes.legendItem}>
            <i className={classes.dot} style={{ backgroundColor: primaryGreen }} />
            {i18n.t("agenda.legend.individual")}
          </span>
          <span className={classes.legendItem}>
            <i className={classes.dot} style={{ backgroundColor: collectiveBlue }} />
            {i18n.t("agenda.legend.collective")}
          </span>
          <span className={classes.legendItem}>
            <i
              className={classes.dot}
              style={{
                border: `2px solid ${theme.palette.warning.main}`,
                backgroundColor: "transparent",
              }}
            />
            {i18n.t("agenda.legend.mine")}
          </span>
        </Box>

        {!loadError && (
          <>
            <AgendaFilters
              quickFilter={quickFilter}
              onQuickFilter={setQuickFilter}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onClear={clearFilters}
            />
            <AgendaStats
              periodTotal={appointmentsRaw.length}
              filteredCount={filteredAppointments.length}
              todayInFiltered={todayInFiltered}
              filtersActive={filtersActive}
              inVisibleRange={filteredInVisibleRange}
            />
          </>
        )}

        {loadError && (
          <Box className={classes.errorBanner}>
            {i18n.t("agenda.loadError")}
          </Box>
        )}

        {viewMode === "calendar" &&
          !loading &&
          filteredEvents.length === 0 &&
          appointmentsRaw.length > 0 &&
          !loadError && (
            <Box className={classes.periodHint}>
              <Typography variant="subtitle2" color="textPrimary" gutterBottom>
                {i18n.t("agenda.filters.emptyFilteredTitle")}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {i18n.t("agenda.filters.emptyFilteredSubtitle")}
              </Typography>
            </Box>
          )}

        {viewMode === "calendar" &&
          !loading &&
          appointmentsRaw.length === 0 &&
          !loadError && (
            <Box className={classes.periodHint}>
              <Typography variant="body2" color="textSecondary">
                {i18n.t("agenda.emptyState")}
              </Typography>
            </Box>
          )}

        {viewMode === "calendar" ? (
          <Box className={classes.calendarShell}>
            {loading && (
              <Box className={classes.loadingOverlay}>
                <CircularProgress size={44} />
              </Box>
            )}
            <AgendaCalendarDnD
              localizer={localizer}
              culture={
                lang.startsWith("en") ? "en-US" : lang.startsWith("es") ? "es" : "pt-BR"
              }
              date={calendarDate}
              onNavigate={(d) => setCalendarDate(d)}
              view={calendarView}
              onView={(v) => setCalendarView(v)}
              views={["month", "week", "day"]}
              defaultView="month"
              events={filteredEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ minHeight: 520, height: "100%" }}
              onRangeChange={onRangeChange}
              onSelectSlot={openNew}
              onSelectEvent={onSelectEvent}
              selectable
              resizable
              draggableAccessor={eventCanEditDnd}
              resizableAccessor={eventCanEditDnd}
              onEventDrop={onEventDrop}
              onEventResize={onEventResize}
              scrollToTime={scrollToTime}
              eventPropGetter={eventStyleGetter}
              popup
              step={30}
              timeslots={2}
              showMultiDayTimes
              components={{
                toolbar: (tbProps) => (
                  <AgendaCalendarToolbar
                    {...tbProps}
                    onNewEvent={() => {
                      const n = moment.tz(agendaTz);
                      openNew({
                        start: n.toDate(),
                        end: n.clone().add(1, "hour").toDate(),
                      });
                    }}
                  />
                ),
                event: AgendaCalendarEvent,
              }}
              messages={{
                next: i18n.t("agenda.calendar.next"),
                previous: i18n.t("agenda.calendar.prev"),
                today: i18n.t("agenda.calendar.today"),
                month: i18n.t("agenda.calendar.month"),
                week: i18n.t("agenda.calendar.week"),
                day: i18n.t("agenda.calendar.day"),
                agenda: i18n.t("agenda.calendar.agenda"),
                date: i18n.t("agenda.calendar.date"),
                time: i18n.t("agenda.calendar.time"),
                event: i18n.t("agenda.calendar.event"),
                showMore: (n) => i18n.t("agenda.calendar.showMore", { count: n }),
              }}
            />
          </Box>
        ) : (
          <AgendaListView
            listGroups={listGroups}
            loading={loading}
            user={user}
            elevated={elevated}
            onOpenEvent={openEvent}
            onDeleteRequest={requestDeleteFromList}
            onDuplicateRequest={openDuplicate}
            onCreateClick={() => {
              const n = moment.tz(agendaTz);
              openNew({ start: n.toDate(), end: n.clone().add(1, "hour").toDate() });
            }}
            locale={localeForFormat}
            timezone={agendaTz}
            hasRawAppointments={appointmentsRaw.length > 0}
          />
        )}
      </Paper>

      <AgendaEventModal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        editing={editing}
        form={form}
        setForm={setForm}
        user={user}
        elevated={elevated}
        participantOptions={participantOptions}
        canEdit={Boolean(!editing || canEditCurrent)}
        isCreate={!editing}
        locale={localeForFormat}
        timezone={agendaTz}
        onSave={save}
        onDeleteClick={requestDeleteFromModal}
        onDuplicateClick={handleDuplicateFromModal}
        onRespond={handleRespond}
        responding={responding}
      />

      <ConfirmationModal
        open={confirmDeleteOpen}
        title={i18n.t("agenda.deleteConfirmTitle")}
        onClose={(v) => {
          setConfirmDeleteOpen(v);
          if (v === false) setDeleteTarget(null);
        }}
        onConfirm={runDelete}
        confirmText={i18n.t("agenda.deleteConfirmAction")}
        destructive
      >
        {deleteTarget?.title
          ? `${i18n.t("agenda.deleteConfirmMessage")} (${deleteTarget.title})`
          : i18n.t("agenda.deleteConfirmMessage")}
      </ConfirmationModal>
    </MainContainer>
  );
};

export default Agenda;
