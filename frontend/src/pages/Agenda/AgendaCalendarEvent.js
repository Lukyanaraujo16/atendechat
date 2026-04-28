import React from "react";
import PropTypes from "prop-types";
import { Box, Typography } from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import moment from "moment-timezone";
import PeopleIcon from "@material-ui/icons/People";
import PersonIcon from "@material-ui/icons/Person";
import { i18n } from "../../translate/i18n";
import { contrastTextOnHex } from "./agendaUtils";

const useStyles = makeStyles((theme) => ({
  root: (props) => ({
    height: "100%",
    minHeight: 18,
    overflow: "hidden",
    padding: "3px 8px",
    borderRadius: 8,
    borderLeft:
      props.accentBorder && props.accentBorder !== "transparent"
        ? `3px solid ${props.accentBorder}`
        : "3px solid transparent",
    backgroundColor: props.eventBg,
    color: props.textColor,
    transition: theme.transitions.create(["background-color", "box-shadow", "filter"], {
      duration: theme.transitions.duration.short,
    }),
    boxShadow:
      theme.palette.type === "dark"
        ? "0 1px 3px rgba(0,0,0,0.45)"
        : "0 1px 2px rgba(60,64,67,0.18)",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: props.eventBgHover,
      boxShadow:
        theme.palette.type === "dark"
          ? "0 3px 10px rgba(0,0,0,0.55)"
          : "0 2px 8px rgba(60,64,67,0.28)",
      filter: props.fillSolid ? "brightness(0.96)" : "none",
    },
  }),
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: 4,
    minWidth: 0,
  },
  icon: {
    fontSize: "0.85rem",
    marginTop: 1,
    opacity: 0.95,
    flexShrink: 0,
  },
  textCol: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    fontWeight: 600,
    fontSize: "0.72rem",
    lineHeight: 1.25,
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  time: {
    fontSize: "0.65rem",
    opacity: 0.92,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  badge: {
    fontSize: "0.58rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    opacity: 0.88,
    marginBottom: 1,
  },
}));

/**
 * Evento customizado para react-big-calendar (aparência tipo Google Calendar).
 */
function AgendaCalendarEvent({ event }) {
  const theme = useTheme();
  const r = event.resource || {};
  const collective = Boolean(r.isCollective);
  const allDay = Boolean(event.allDay);
  const fillSolid = Boolean(r.fillSolid);
  const lang = (i18n.language || "pt").split("-")[0];
  const m = lang === "en" ? "en" : lang === "es" ? "es" : "pt-br";
  const timeLabel = allDay
    ? i18n.t("agenda.calendarEvent.allDayShort")
    : `${moment(event.start).locale(m).format("LT")} – ${moment(event.end).locale(m).format("LT")}`;

  const isDark = theme.palette.type === "dark";
  let textColor;
  let eventBg;
  let eventBgHover;

  if (fillSolid && r.eventBg) {
    const baseText = r.textColor || contrastTextOnHex(r.eventBg);
    textColor = baseText;
    eventBg = r.eventBg;
    eventBgHover = r.eventBgHover || r.eventBg;
  } else if (isDark) {
    textColor = collective ? "#aecbfa" : "#81c995";
    eventBg = collective ? "rgba(138, 180, 248, 0.22)" : "rgba(129, 201, 149, 0.22)";
    eventBgHover = collective ? "rgba(138, 180, 248, 0.38)" : "rgba(129, 201, 149, 0.38)";
  } else {
    textColor = r.textColor || theme.palette.text.primary;
    eventBg = r.eventBg || theme.palette.action.hover;
    eventBgHover = r.eventBgHover || theme.palette.action.selected;
  }

  const classes = useStyles({
    accentBorder: r.accentBorder,
    eventBg,
    eventBgHover,
    textColor,
    fillSolid,
  });

  const tooltip = [
    event.title,
    allDay ? i18n.t("agenda.calendarEvent.allDayShort") : timeLabel,
    collective ? i18n.t("agenda.legend.collective") : i18n.t("agenda.legend.individual"),
  ]
    .filter(Boolean)
    .join(" · ");

  const Icon = collective ? PeopleIcon : PersonIcon;

  return (
    <Box className={classes.root} title={tooltip}>
      {collective && (
        <Typography component="div" className={classes.badge}>
          {i18n.t("agenda.calendarEvent.collectiveTag")}
        </Typography>
      )}
      <Box className={classes.row}>
        <Icon className={classes.icon} style={{ color: textColor }} />
        <Box className={classes.textCol}>
          <Typography component="div" className={classes.title} style={{ color: textColor }}>
            {event.title}
          </Typography>
          {!allDay && (
            <Typography component="div" className={classes.time} style={{ color: textColor }}>
              {timeLabel}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

AgendaCalendarEvent.propTypes = {
  event: PropTypes.shape({
    title: PropTypes.string,
    start: PropTypes.instanceOf(Date),
    end: PropTypes.instanceOf(Date),
    allDay: PropTypes.bool,
    resource: PropTypes.object,
  }).isRequired,
};

export default AgendaCalendarEvent;
