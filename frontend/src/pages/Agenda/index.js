import React, { useState, useEffect, useCallback, useContext, useMemo, useRef } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
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

import AgendaCalendarToolbar from "./AgendaCalendarToolbar";
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
} from "./agendaUtils";

const localizer = momentLocalizer(moment);

const isElevated = (profile) => profile === "admin" || profile === "supervisor";

function toCalendarEvents(list, myId) {
  if (!isArray(list)) return [];
  return list.map((a) => ({
    id: a.id,
    title: a.title,
    start: new Date(a.startAt),
    end: new Date(a.endAt),
    allDay: Boolean(a.allDay),
    resource: { ...a, isMine: Number(a.createdBy) === Number(myId) },
  }));
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
    minHeight: 480,
    padding: theme.spacing(0, 0, 1, 0),
    "& .rbc-calendar": {
      fontFamily: theme.typography.fontFamily,
      color: theme.palette.text.primary,
    },
    "& .rbc-header": {
      borderBottom: `1px solid ${theme.palette.divider}`,
      color: theme.palette.text.secondary,
      fontWeight: 600,
      fontSize: "0.75rem",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      padding: theme.spacing(1, 0),
    },
    "& .rbc-today": {
      backgroundColor:
        theme.palette.type === "dark"
          ? alpha(theme.palette.primary.main, 0.18)
          : theme.palette.action.selected,
      boxShadow:
        theme.palette.type === "dark"
          ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.45)}`
          : "none",
    },
    "& .rbc-off-range-bg": {
      background: theme.palette.action.hover,
    },
    "& .rbc-month-view, & .rbc-time-view, & .rbc-day-view": {
      borderColor: theme.palette.divider,
    },
    "& .rbc-day-bg + .rbc-day-bg, & .rbc-month-row + .rbc-month-row": {
      borderColor: theme.palette.divider,
    },
    "& .rbc-time-slot": {
      borderColor: theme.palette.divider,
    },
    "& .rbc-time-header-content": {
      borderColor: theme.palette.divider,
    },
    "& .rbc-current-time-indicator": {
      backgroundColor: theme.palette.primary.main,
    },
    "& .rbc-show-more": {
      color: theme.palette.primary.main,
      fontWeight: 600,
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
  });

  const lang = i18n.language || "pt";
  const localeForFormat = lang.startsWith("en") ? "en" : lang.startsWith("es") ? "es" : "pt";

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
    (r) => {
      const start = r?.start || r?.[0] || moment().startOf("month").toDate();
      const end = r?.end || r?.[1] || moment().endOf("month").toDate();
      setRange({ start, end });
      fetchEvents(start, end);
    },
    [fetchEvents]
  );

  useEffect(() => {
    const start = moment().startOf("month").toDate();
    const end = moment().endOf("month").toDate();
    setRange({ start, end });
    fetchEvents(start, end);
  }, [fetchEvents]);

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

  const primaryGreen = theme.palette.primary.main;
  const collectiveBlue = theme.palette.type === "dark" ? "#42a5f5" : "#1976d2";

  const eventStyleGetter = (ev) => {
    const r = ev.resource;
    const collective = r?.isCollective;
    const mine = r?.isMine;
    return {
      style: {
        backgroundColor: collective ? collectiveBlue : primaryGreen,
        border: mine ? `2px solid ${theme.palette.warning.main}` : "none",
        borderRadius: 8,
        color: "#fff",
        fontWeight: 500,
        fontSize: "0.8125rem",
        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
      },
    };
  };

  const openNew = (slot) => {
    setEditing(null);
    const s = moment(slot.start);
    const e = moment(slot.end);
    if (s.isSame(e, "day") && s.format("HH:mm") === e.format("HH:mm")) {
      e.add(1, "hour");
    }
    setForm({
      title: "",
      description: "",
      startAt: s.format("YYYY-MM-DDTHH:mm"),
      endAt: e.format("YYYY-MM-DDTHH:mm"),
      allDay: false,
      isCollective: false,
      visibility: "private",
      participantUserIds: [],
    });
    setOpen(true);
  };

  const openEvent = useCallback(
    (calEventOrRaw) => {
      const a = calEventOrRaw?.resource || calEventOrRaw;
      if (!a) return;
      setEditing(a);
      setForm({
        title: a.title || "",
        description: a.description || "",
        startAt: moment(a.startAt).format("YYYY-MM-DDTHH:mm"),
        endAt: moment(a.endAt).format("YYYY-MM-DDTHH:mm"),
        allDay: Boolean(a.allDay),
        isCollective: Boolean(a.isCollective),
        visibility: a.visibility || "private",
        participantUserIds: (a.participants || [])
          .map((p) => p.userId)
          .filter((id) => Number(id) !== Number(user.id)),
      });
      setOpen(true);
    },
    [user?.id]
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
    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      allDay: form.allDay,
      isCollective: elevated && form.isCollective,
      visibility: elevated && form.isCollective ? form.visibility : "private",
      participantUserIds: elevated && form.isCollective ? pid : [],
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

  const participantOptions = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        label: u.name || u.email || String(u.id),
      })),
    [users]
  );

  const filteredAfterQuick = useMemo(
    () => applyQuickFilter(appointmentsRaw, quickFilter, user?.id),
    [appointmentsRaw, quickFilter, user?.id]
  );

  const filteredAppointments = useMemo(
    () => filteredAfterQuick.filter((a) => matchesSearchText(a, searchQuery)),
    [filteredAfterQuick, searchQuery]
  );

  const filteredEvents = useMemo(
    () => toCalendarEvents(filteredAppointments, user?.id),
    [filteredAppointments, user?.id]
  );

  const listGroups = useMemo(
    () => groupAppointmentsByStartDay(filteredAppointments),
    [filteredAppointments]
  );

  const todayInFiltered = useMemo(
    () => countOverlappingToday(filteredAppointments),
    [filteredAppointments]
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
      ? `${moment(range.start).format("LL")} — ${moment(range.end).format("LL")}`
      : "";

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
        <MainHeaderButtonsWrapper>
          <Button
            color="primary"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openNew({ start: new Date(), end: new Date() })}
          >
            {i18n.t("agenda.newEvent")}
          </Button>
        </MainHeaderButtonsWrapper>
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
            <Calendar
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
              style={{ height: "100%" }}
              onRangeChange={onRangeChange}
              onSelectSlot={openNew}
              onSelectEvent={onSelectEvent}
              selectable
              eventPropGetter={eventStyleGetter}
              popup
              components={{
                toolbar: AgendaCalendarToolbar,
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
            onCreateClick={() => openNew({ start: new Date(), end: new Date() })}
            locale={localeForFormat}
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
        onSave={save}
        onDeleteClick={requestDeleteFromModal}
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
