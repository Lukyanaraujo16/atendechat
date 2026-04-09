import React, { useState, useEffect, useReducer, useCallback, useContext } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import { AppSectionCard } from "../../ui";
import ScheduleModal from "../../components/ScheduleModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import moment from "moment-timezone";
import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import { Calendar, momentLocalizer } from "react-big-calendar";
import "moment/locale/pt-br";
import "react-big-calendar/lib/css/react-big-calendar.css";
import SearchIcon from "@material-ui/icons/Search";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import PauseCircleOutlineIcon from "@material-ui/icons/PauseCircleOutline";
import PlayCircleOutlineIcon from "@material-ui/icons/PlayCircleOutline";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";

import "./Schedules.css"; // Importe o arquivo CSS
import { createMomentLocalizer } from "../../translate/calendar-locale";

// Defina a função getUrlParam antes de usá-la
function getUrlParam(paramName) {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get(paramName);
}

const eventTitleStyle = {
  fontSize: "14px", // Defina um tamanho de fonte menor
  overflow: "hidden", // Oculte qualquer conteúdo excedente
  whiteSpace: "nowrap", // Evite a quebra de linha do texto
  textOverflow: "ellipsis", // Exiba "..." se o texto for muito longo
};

var defaultMessages = {
  date: i18n.t("schedules.messages.date"),
  time: i18n.t("schedules.messages.time"),
  event: i18n.t("schedules.messages.event"),
  allDay: i18n.t("schedules.messages.allDay"),
  week: i18n.t("schedules.messages.week"),
  work_week: i18n.t("schedules.messages.work_week"),
  day: i18n.t("schedules.messages.day"),
  month: i18n.t("schedules.messages.month"),
  previous: i18n.t("schedules.messages.previous"),
  next: i18n.t("schedules.messages.next"),
  yesterday: i18n.t("schedules.messages.yesterday"),
  tomorrow: i18n.t("schedules.messages.tomorrow"),
  today: i18n.t("schedules.messages.today"),
  agenda: i18n.t("schedules.messages.agenda"),
  noEventsInRange: i18n.t("schedules.messages.noEventsInRange"),
  showMore: function showMore(total) {
    return "+" + total + " " + i18n.t("schedules.messages.showMore");
  }
};

const reducer = (state, action) => {
  if (action.type === "LOAD_SCHEDULES") {
    return [...state, ...action.payload];
  }

  if (action.type === "UPDATE_SCHEDULES") {
    const schedule = action.payload;
    const scheduleIndex = state.findIndex((s) => s.id === schedule.id);

    if (scheduleIndex !== -1) {
      state[scheduleIndex] = schedule;
      return [...state];
    } else {
      return [schedule, ...state];
    }
  }

  if (action.type === "DELETE_SCHEDULE") {
    const scheduleId = action.payload;
    return state.filter((s) => s.id !== scheduleId);
  }

  if (action.type === "RESET") {
    return [];
  }

  return state;
};

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
  },
}));

const Schedules = () => {
  const localizer = createMomentLocalizer();
  const classes = useStyles();
  const history = useHistory();

  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [deletingSchedule, setDeletingSchedule] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [schedules, dispatch] = useReducer(reducer, []);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [contactId, setContactId] = useState(+getUrlParam("contactId"));
  const [companyTz, setCompanyTz] = useState("America/Sao_Paulo");


  useEffect(() => {
    if (!user?.companyId) return;
    (async () => {
      try {
        const { data } = await api.get(`/companies/${user.companyId}`);
        setCompanyTz(data?.timezone || "America/Sao_Paulo");
      } catch (e) {
        /* mantém default */
      }
    })();
  }, [user?.companyId]);

  const fetchSchedules = useCallback(async () => {
    try {
      const { data } = await api.get("/schedules/", {
        params: { searchParam, pageNumber },
      });

      dispatch({ type: "LOAD_SCHEDULES", payload: data.schedules });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      toastError(err);
    }
  }, [searchParam, pageNumber]);

  const handleOpenScheduleModalFromContactId = useCallback(() => {
    if (contactId) {
      handleOpenScheduleModal();
    }
  }, [contactId]);

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchSchedules();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [
    searchParam,
    pageNumber,
    contactId,
    fetchSchedules,
    handleOpenScheduleModalFromContactId,
  ]);

  useEffect(() => {
    handleOpenScheduleModalFromContactId();
    const socket = socketManager.getSocket(user.companyId);

    const onSchedule = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_SCHEDULES", payload: data.schedule });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_SCHEDULE", payload: +data.scheduleId });
      }
    };

    socket.on("schedule", onSchedule);

    return () => {
      socket.off("schedule", onSchedule);
    };
  }, [handleOpenScheduleModalFromContactId, socketManager, user]);

  const cleanContact = () => {
    setContactId("");
  };

  const handleOpenScheduleModal = () => {
    setSelectedSchedule(null);
    setScheduleModalOpen(true);
  };

  const handleCloseScheduleModal = () => {
    setSelectedSchedule(null);
    setScheduleModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditSchedule = (schedule) => {
    setSelectedSchedule(schedule);
    setScheduleModalOpen(true);
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await api.delete(`/schedules/${scheduleId}`);
      toast.success(i18n.t("schedules.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingSchedule(null);
    setSearchParam("");
    setPageNumber(1);

    dispatch({ type: "RESET" });
    setPageNumber(1);
    await fetchSchedules();
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const truncate = (str, len) => {
    if (str.length > len) {
      return str.substring(0, len) + "...";
    }
    return str;
  };

  const contactLabel = (schedule) => {
    const names = (schedule.scheduleContacts || [])
      .map((sc) => sc.contact?.name)
      .filter(Boolean);
    if (names.length) {
      return names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0];
    }
    return schedule.contact?.name || "—";
  };

  const eventDate = (schedule) => {
    if (schedule.scheduleType === "recurring" && schedule.nextRunAt) {
      return new Date(schedule.nextRunAt);
    }
    return new Date(schedule.sendAt);
  };

  const formatUtcInCompanyTz = (utcDate) => {
    if (!utcDate) return "—";
    return moment.utc(utcDate).tz(companyTz).format("DD/MM/YYYY HH:mm");
  };

  const handleTogglePause = async (schedule) => {
    if (user.profile !== "admin") return;
    const active = schedule.isActive !== false;
    try {
      await api.put(`/schedules/${schedule.id}`, {
        isActive: !active,
      });
      toast.success(i18n.t("scheduleModal.success"));
      await fetchSchedules();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingSchedule &&
          `${i18n.t("schedules.confirmationModal.deleteTitle")}`
        }
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={() => handleDeleteSchedule(deletingSchedule.id)}
      >
        {i18n.t("schedules.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <ScheduleModal
        open={scheduleModalOpen}
        onClose={handleCloseScheduleModal}
        reload={fetchSchedules}
        aria-labelledby="form-dialog-title"
        scheduleId={selectedSchedule && selectedSchedule.id}
        contactId={contactId}
        cleanContact={cleanContact}
      />
      <MainHeader>
        <Title>{i18n.t("schedules.title")} ({schedules.length})</Title>
        <MainHeaderButtonsWrapper>
          <TextField
            placeholder={i18n.t("contacts.searchPlaceholder")}
            type="search"
            value={searchParam}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon style={{ color: "gray" }} />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenScheduleModal}
          >
            {i18n.t("schedules.buttons.add")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <AppSectionCard
        dense
        scrollable
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <Typography variant="body2" color="textSecondary" style={{ padding: "8px 4px" }}>
          {i18n.t("schedules.listIntro")}{" "}
          <span style={{ whiteSpace: "nowrap" }}>
            ({i18n.t("schedules.companyTimezoneShort")}: {companyTz})
          </span>
        </Typography>
        <Calendar
          messages={defaultMessages}
          formats={{
            agendaDateFormat: "DD/MM ddd",
            weekdayFormat: "dddd",
          }}
          localizer={localizer}
          events={schedules.map((schedule) => ({
            title: (
              <div className="event-container">
                <div style={eventTitleStyle}>
                  {contactLabel(schedule)}
                  <span style={{ fontSize: "11px", opacity: 0.85, display: "block" }}>
                    {schedule.scheduleType === "recurring"
                      ? i18n.t("schedules.typeRecurring")
                      : i18n.t("schedules.typeSingle")}
                    {" · "}
                    {i18n.t(`schedules.statusLabels.${schedule.status || "PENDENTE"}`)}
                    {schedule.preferredWhatsapp?.name
                      ? ` · ${i18n.t("schedules.preferredShort")}: ${schedule.preferredWhatsapp.name}`
                      : ""}
                  </span>
                </div>
                <DeleteOutlineIcon
                  onClick={() => {
                    setDeletingSchedule(schedule);
                    setConfirmModalOpen(true);
                  }}
                  className="delete-icon"
                />
                <EditIcon
                  onClick={() => {
                    handleEditSchedule(schedule);
                    setScheduleModalOpen(true);
                  }}
                  className="edit-icon"
                />
              </div>
            ),
            start: eventDate(schedule),
            end: eventDate(schedule),
          }))}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 500 }}
        />
        <Table size="small" style={{ marginTop: 16 }}>
          <TableHead>
            <TableRow>
              <TableCell>{i18n.t("schedules.table.type")}</TableCell>
              <TableCell>{i18n.t("schedules.table.contact")}</TableCell>
              <TableCell>{i18n.t("schedules.table.recurrence")}</TableCell>
              <TableCell align="right">{i18n.t("schedules.table.contacts")}</TableCell>
              <TableCell>{i18n.t("schedules.table.nextRun")}</TableCell>
              <TableCell>{i18n.t("schedules.table.status")}</TableCell>
              <TableCell align="right">{i18n.t("schedules.table.actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schedules.map((row) => {
              const n =
                row.scheduleContacts?.length ||
                (row.contactId ? 1 : 0);
              const next =
                row.scheduleType === "recurring" && row.nextRunAt
                  ? formatUtcInCompanyTz(row.nextRunAt)
                  : row.sendAt
                    ? formatUtcInCompanyTz(row.sendAt)
                    : "—";
              const freq =
                row.scheduleType === "recurring" && row.recurrenceType
                  ? i18n.t(`schedules.frequencyShort.${row.recurrenceType}`)
                  : "—";
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.scheduleType === "recurring"
                      ? i18n.t("schedules.typeRecurring")
                      : i18n.t("schedules.typeSingle")}
                    {row.scheduleType === "recurring" && row.isActive === false
                      ? ` (${i18n.t("schedules.paused")})`
                      : ""}
                  </TableCell>
                  <TableCell>{truncate(contactLabel(row), 40)}</TableCell>
                  <TableCell>{freq}</TableCell>
                  <TableCell align="right">{n}</TableCell>
                  <TableCell>{next}</TableCell>
                  <TableCell>{i18n.t(`schedules.statusLabels.${row.status || "PENDENTE"}`)}</TableCell>
                  <TableCell align="right">
                    {user.profile === "admin" &&
                      row.scheduleType === "recurring" &&
                      row.sentAt == null && (
                        <Tooltip
                          title={
                            row.isActive === false
                              ? i18n.t("schedules.buttons.resume")
                              : i18n.t("schedules.buttons.pause")
                          }
                        >
                          <IconButton
                            size="small"
                            onClick={() => handleTogglePause(row)}
                            aria-label="pause-toggle"
                          >
                            {row.isActive === false ? (
                              <PlayCircleOutlineIcon fontSize="small" />
                            ) : (
                              <PauseCircleOutlineIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      )}
                    <IconButton size="small" onClick={() => handleEditSchedule(row)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDeletingSchedule(row);
                        setConfirmModalOpen(true);
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </AppSectionCard>
    </MainContainer>
  );
};

export default Schedules;