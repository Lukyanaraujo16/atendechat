import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import ChevronLeft from "@material-ui/icons/ChevronLeft";
import ChevronRight from "@material-ui/icons/ChevronRight";
import Box from "@material-ui/core/Box";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  toolbar: {
    flexWrap: "wrap",
    gap: theme.spacing(1),
    minHeight: 56,
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : theme.palette.grey[50],
  },
  title: {
    flex: "1 1 160px",
    textAlign: "center",
    fontWeight: 600,
    lineHeight: 1.3,
  },
  navGroup: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    flex: "0 0 auto",
  },
  viewGroup: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(0.5),
    flex: "0 0 auto",
    justifyContent: "flex-end",
  },
  navBtn: {
    borderRadius: theme.shape.borderRadius,
  },
}));

/**
 * Toolbar customizada para react-big-calendar (Hoje / navegação / Mês·Semana·Dia).
 */
const AgendaCalendarToolbar = (props) => {
  const classes = useStyles();
  const { label, onNavigate, onView, view, views } = props;
  const viewKeys = Array.isArray(views)
    ? views
    : views && typeof views === "object"
      ? Object.keys(views)
      : ["month", "week", "day"];
  const allowed = ["month", "week", "day"].filter((v) => viewKeys.includes(v));

  return (
    <Toolbar variant="dense" className={classes.toolbar} disableGutters>
      <Box className={classes.navGroup}>
        <Button
          size="small"
          variant="outlined"
          className={classes.navBtn}
          onClick={() => onNavigate("TODAY")}
        >
          {i18n.t("agenda.calendar.today")}
        </Button>
        <IconButton
          size="small"
          onClick={() => onNavigate("PREV")}
          aria-label={i18n.t("agenda.calendar.prev")}
        >
          <ChevronLeft />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => onNavigate("NEXT")}
          aria-label={i18n.t("agenda.calendar.next")}
        >
          <ChevronRight />
        </IconButton>
      </Box>
      <Typography variant="h6" component="div" className={classes.title} color="textPrimary">
        {label}
      </Typography>
      <Box className={classes.viewGroup}>
        {allowed.map((v) => (
          <Button
            key={v}
            size="small"
            variant={view === v ? "contained" : "outlined"}
            color={view === v ? "primary" : "default"}
            className={classes.navBtn}
            onClick={() => onView(v)}
          >
            {i18n.t(`agenda.calendar.${v}`)}
          </Button>
        ))}
      </Box>
    </Toolbar>
  );
};

export default AgendaCalendarToolbar;
