import React, { useState, useEffect, useCallback, useContext, useMemo } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "moment/locale/pt-br";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import TextField from "@material-ui/core/TextField";
import FormControl from "@material-ui/core/FormControl";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import FormLabel from "@material-ui/core/FormLabel";
import RadioGroup from "@material-ui/core/RadioGroup";
import Radio from "@material-ui/core/Radio";
import Switch from "@material-ui/core/Switch";
import Autocomplete from "@material-ui/lab/Autocomplete";
import Chip from "@material-ui/core/Chip";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import AddIcon from "@material-ui/icons/Add";

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
import IconButton from "@material-ui/core/IconButton";
import ConfirmationModal from "../../components/ConfirmationModal";

const localizer = momentLocalizer(moment);

const useStyles = makeStyles((theme) => ({
  root: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
  calendarWrap: {
    position: "relative",
    height: "calc(100vh - 220px)",
    minHeight: 480,
    padding: theme.spacing(0, 0, 2, 0),
  },
  loadingOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  legend: { display: "flex", gap: theme.spacing(2), flexWrap: "wrap", marginBottom: theme.spacing(1) },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    display: "inline-block",
    marginRight: theme.spacing(0.5),
  },
}));

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

const Agenda = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);
  const elevated = isElevated(user?.profile);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [range, setRange] = useState(null);
  const [open, setOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [editing, setEditing] = useState(null);
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
      try {
        const { data } = await api.get("/appointments", {
          params: {
            start: start.toISOString(),
            end: end.toISOString(),
          },
        });
        setEvents(toCalendarEvents(data, user.id));
      } catch (e) {
        toastError(e);
        setEvents([]);
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
    moment.locale(i18n.language === "en" ? "en" : "pt-br");
  }, [i18n.language]);

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

  const eventStyleGetter = (ev) => {
    const r = ev.resource;
    const collective = r?.isCollective;
    const mine = r?.isMine;
    return {
      style: {
        backgroundColor: collective ? "#1976d2" : "#2e7d32",
        border: mine ? "2px solid #ffc107" : "none",
        borderRadius: 4,
        color: "#fff",
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

  const openEdit = (calEvent) => {
    const a = calEvent.resource;
    if (!a) return;
    const can =
      Number(a.createdBy) === Number(user.id) || (elevated && a.isCollective);
    if (!can) {
      toast.info(i18n.t("agenda.toasts.readOnly"));
      return;
    }
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
        .filter((id) => id !== user.id),
    });
    setOpen(true);
  };

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
    if (Number.isNaN(new Date(payload.startAt).getTime()) || Number.isNaN(new Date(payload.endAt).getTime())) {
      toast.error(i18n.t("agenda.form.invalidDate"));
      return;
    }
    if (new Date(payload.endAt) <= new Date(payload.startAt)) {
      toast.error(i18n.t("agenda.form.endAfterStart"));
      return;
    }
    if (payload.isCollective && payload.visibility === "private" && (!payload.participantUserIds || payload.participantUserIds.length === 0)) {
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
      if (range?.start && range?.end) fetchEvents(range.start, range.end);
    } catch (e) {
      toastError(e);
    }
  };

  const runDelete = async () => {
    if (!editing?.id) return;
    try {
      await api.delete(`/appointments/${editing.id}`);
      toast.success(i18n.t("agenda.toasts.deleted"));
      setOpen(false);
      setConfirmDeleteOpen(false);
      if (range?.start && range?.end) fetchEvents(range.start, range.end);
    } catch (e) {
      toastError(e);
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

      <div className={classes.legend}>
        <span>
          <i className={classes.dot} style={{ backgroundColor: "#2e7d32" }} />
          {i18n.t("agenda.legend.individual")}
        </span>
        <span>
          <i className={classes.dot} style={{ backgroundColor: "#1976d2" }} />
          {i18n.t("agenda.legend.collective")}
        </span>
        <span>
          <i
            className={classes.dot}
            style={{ border: "2px solid #ffc107", backgroundColor: "transparent" }}
          />
          {i18n.t("agenda.legend.mine")}
        </span>
      </div>

      {!loading && events.length === 0 && (
        <Box py={1} textAlign="center" color="textSecondary">
          <Typography variant="body2">{i18n.t("agenda.emptyState")}</Typography>
        </Box>
      )}

      <Paper className={classes.calendarWrap} elevation={0}>
        {loading && (
          <Box className={classes.loadingOverlay}>
            <CircularProgress size={40} />
          </Box>
        )}
        <Calendar
          localizer={localizer}
          culture={i18n.language === "en" ? "en" : "pt-BR"}
          defaultView="month"
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          onRangeChange={onRangeChange}
          onSelectSlot={openNew}
          onSelectEvent={openEdit}
          selectable
          eventPropGetter={eventStyleGetter}
          popup
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
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" scroll="body">
        <DialogTitle>
          {editing ? i18n.t("agenda.form.edit") : i18n.t("agenda.form.create")}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label={i18n.t("agenda.form.title")}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <TextField
            fullWidth
            margin="normal"
            label={i18n.t("agenda.form.description")}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            multiline
            minRows={2}
          />
          <TextField
            fullWidth
            margin="normal"
            type="datetime-local"
            label={i18n.t("agenda.form.start")}
            value={form.startAt}
            onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            disabled={form.allDay}
          />
          <TextField
            fullWidth
            margin="normal"
            type="datetime-local"
            label={i18n.t("agenda.form.end")}
            value={form.endAt}
            onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            disabled={form.allDay}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.allDay}
                onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
                color="primary"
              />
            }
            label={i18n.t("agenda.form.allDay")}
          />
          {elevated && (!editing || editing.isCollective) && (
            <>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isCollective}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        isCollective: e.target.checked,
                        visibility: e.target.checked ? f.visibility : "private",
                      }))
                    }
                    color="primary"
                  />
                }
                label={i18n.t("agenda.form.collective")}
              />
              {form.isCollective && (
                <FormControl component="fieldset" margin="normal" fullWidth>
                  <FormLabel component="legend">{i18n.t("agenda.form.visibility")}</FormLabel>
                  <RadioGroup
                    value={form.visibility}
                    onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
                  >
                    <FormControlLabel value="private" control={<Radio color="primary" />} label={i18n.t("agenda.form.visPrivate")} />
                    <FormControlLabel value="team" control={<Radio color="primary" />} label={i18n.t("agenda.form.visTeam")} />
                    <FormControlLabel value="company" control={<Radio color="primary" />} label={i18n.t("agenda.form.visCompany")} />
                  </RadioGroup>
                </FormControl>
              )}
              {form.isCollective && (
                <Autocomplete
                  multiple
                  options={participantOptions}
                  getOptionLabel={(o) => o.label}
                  value={participantOptions.filter((o) => form.participantUserIds.includes(o.id))}
                  onChange={(_, v) =>
                    setForm((f) => ({ ...f, participantUserIds: (v || []).map((x) => x.id) }))
                  }
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip label={option.label} {...getTagProps({ index })} size="small" />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      margin="normal"
                      label={i18n.t("agenda.form.participants")}
                    />
                  )}
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          {editing && (Number(editing.createdBy) === Number(user.id) || (elevated && editing.isCollective)) && (
            <IconButton
              onClick={() => setConfirmDeleteOpen(true)}
              aria-label="delete"
              edge="start"
            >
              <DeleteOutlineIcon />
            </IconButton>
          )}
          <Button onClick={() => setOpen(false)}>{i18n.t("agenda.form.cancel")}</Button>
          <Button color="primary" variant="contained" onClick={save}>
            {i18n.t("agenda.form.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationModal
        open={confirmDeleteOpen}
        title={i18n.t("agenda.deleteConfirmTitle")}
        onClose={setConfirmDeleteOpen}
        onConfirm={runDelete}
        confirmText={i18n.t("agenda.deleteConfirmAction")}
        destructive
      >
        {i18n.t("agenda.deleteConfirmMessage")}
      </ConfirmationModal>
    </MainContainer>
  );
};

export default Agenda;
